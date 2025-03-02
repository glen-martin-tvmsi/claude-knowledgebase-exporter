## Create build.sh script
create_build_script() {
   echo -e "\n${YELLOW}Creating build.sh script...${NC}"
   backup_file "build.sh"
   
   cat > build.sh << 'EOF'
#!/bin/bash

# Claude Knowledge Base Exporter - Build Script
# This script packages the extension files into a zip file for distribution

# Set up colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Claude Knowledge Base Exporter Builder${NC}"
echo -e "${BLUE}======================================${NC}"

# Create builds directory if it doesn't exist
echo -e "\n${YELLOW}Setting up build environment...${NC}"
if [ ! -d "builds" ]; then
   mkdir -p builds
   echo -e "${GREEN}Created builds directory${NC}"
else
   echo -e "${GREEN}Builds directory already exists${NC}"
fi

# Check for required files
echo -e "\n${YELLOW}Checking for required files...${NC}"
REQUIRED_FILES=("manifest.json" "background.js" "content.js" "popup.html" "popup.js" "styles.css")
MISSING_FILES=0

for file in "${REQUIRED_FILES[@]}"; do
   if [ ! -f "$file" ]; then
       echo -e "${RED}Missing required file: $file${NC}"
       MISSING_FILES=$((MISSING_FILES+1))
   else
       echo -e "${GREEN}Found: $file${NC}"
   fi
done

# Check for icons directory and files
if [ ! -d "icons" ]; then
   echo -e "${RED}Missing icons directory${NC}"
   MISSING_FILES=$((MISSING_FILES+1))
else
   echo -e "${GREEN}Found: icons directory${NC}"
   
   # Check for icon files
   ICON_FILES=("icon16.png" "icon48.png" "icon128.png")
   for icon in "${ICON_FILES[@]}"; do
       if [ ! -f "icons/$icon" ]; then
           echo -e "${YELLOW}Warning: Missing icon file: icons/$icon${NC}"
           
           # Create placeholder icon if it doesn't exist
           echo -e "${YELLOW}Creating placeholder icon for: $icon${NC}"
           
           # Determine size from filename
           SIZE=$(echo $icon | sed 's/[^0-9]*//g')
           
           # Check if we have ImageMagick (convert) available
           if command -v convert >/dev/null 2>&1; then
               convert -size ${SIZE}x${SIZE} xc:blue -fill white -gravity center -pointsize $((SIZE/2)) -annotate 0 "CKB" "icons/$icon"
               echo -e "${GREEN}Created placeholder icon: icons/$icon${NC}"
           else
               # Fallback if ImageMagick is not available - create an empty file
               echo "Placeholder icon" > "icons/$icon"
               echo -e "${YELLOW}Created text placeholder for: icons/$icon${NC}"
               echo -e "${YELLOW}Please replace with a proper icon before using the extension${NC}"
           fi
       else
           echo -e "${GREEN}Found: icons/$icon${NC}"
       fi
   done
fi

# Error out if required files are missing
if [ $MISSING_FILES -gt 0 ]; then
   echo -e "\n${RED}Error: $MISSING_FILES required files are missing. Please create these files before building.${NC}"
   exit 1
fi

# Validate manifest.json
echo -e "\n${YELLOW}Validating manifest.json...${NC}"
if command -v jq >/dev/null 2>&1; then
   if jq empty manifest.json 2>/dev/null; then
       echo -e "${GREEN}manifest.json is valid JSON${NC}"
       
       # Extract extension name and version
       NAME=$(jq -r '.name' manifest.json)
       VERSION=$(jq -r '.version' manifest.json)
       echo -e "${GREEN}Extension: $NAME v$VERSION${NC}"
   else
       echo -e "${RED}manifest.json is not valid JSON!${NC}"
       echo -e "${YELLOW}Continuing anyway, but you should fix this issue${NC}"
       
       # Try to extract name and version with grep as fallback
       NAME=$(grep -o '"name": *"[^"]*"' manifest.json | cut -d '"' -f 4)
       VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | cut -d '"' -f 4)
       
       if [ -z "$NAME" ]; then
           NAME="claude-knowledge-exporter"
       fi
       if [ -z "$VERSION" ]; then
           VERSION="0.0.0"
       fi
   fi
else
   echo -e "${YELLOW}jq not available - skipping detailed JSON validation${NC}"
   echo -e "${YELLOW}Consider installing jq for better validation${NC}"
   
   # Try to extract name and version with grep
   NAME=$(grep -o '"name": *"[^"]*"' manifest.json | cut -d '"' -f 4)
   VERSION=$(grep -o '"version": *"[^"]*"' manifest.json | cut -d '"' -f 4)
   
   if [ -z "$NAME" ]; then
       NAME="claude-knowledge-exporter"
   fi
   if [ -z "$VERSION" ]; then
       VERSION="0.0.0"
   fi
fi

# Create timestamp for the build
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BUILD_NAME="${NAME// /-}-v${VERSION}-${TIMESTAMP}"
ZIP_NAME="builds/${BUILD_NAME}.zip"

# Check for zip command
echo -e "\n${YELLOW}Checking for zip utility...${NC}"
if command -v zip >/dev/null 2>&1; then
   echo -e "${GREEN}Zip utility found${NC}"
else
   echo -e "${RED}Zip utility not found${NC}"
   echo -e "${YELLOW}Attempting to create archive with alternative method...${NC}"
   
   # Check if we're in a GitHub Codespace or similar environment with Node.js
   if command -v node >/dev/null 2>&1; then
       echo -e "${GREEN}Node.js found, creating simple zip script...${NC}"
       
       # Create a temporary Node.js script to create a zip file
       cat > temp_zipper.js << 'EOF_NODE'
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Get args
const zipFile = process.argv[2];
const filesToZip = process.argv.slice(3);

// Create output stream
const output = fs.createWriteStream(zipFile);
const archive = archiver('zip', {
 zlib: { level: 9 } // Compression level
});

// Listen for errors
output.on('close', () => {
 console.log(`Archive created: ${archive.pointer()} total bytes`);
});

archive.on('error', (err) => {
 throw err;
});

// Pipe archive data to the output file
archive.pipe(output);

// Add files to the archive
filesToZip.forEach(filePattern => {
 if (filePattern.includes('*')) {
   // Handle globs by expanding manually (simple case)
   const dir = path.dirname(filePattern);
   const fileGlob = path.basename(filePattern);
   const regex = new RegExp(`^${fileGlob.replace('*', '.*')}$`);
   
   try {
     const files = fs.readdirSync(dir || '.');
     files.forEach(file => {
       if (regex.test(file)) {
         const fullPath = dir ? path.join(dir, file) : file;
         if (fs.statSync(fullPath).isFile()) {
           archive.file(fullPath, { name: fullPath });
         }
       }
     });
   } catch (err) {
     console.error(`Error processing pattern ${filePattern}:`, err);
   }
 } else if (fs.existsSync(filePattern)) {
   const stat = fs.statSync(filePattern);
   if (stat.isDirectory()) {
     archive.directory(filePattern, filePattern);
   } else {
     archive.file(filePattern, { name: filePattern });
   }
 } else {
   console.warn(`Warning: ${filePattern} does not exist`);
 }
});

// Finalize the archive
archive.finalize();
EOF_NODE

       # Check if archiver is installed
       if ! npm list -g archiver >/dev/null 2>&1 && ! npm list archiver >/dev/null 2>&1; then
           echo -e "${YELLOW}Installing archiver package...${NC}"
           npm install archiver --no-save >/dev/null 2>&1 || { echo -e "${RED}Failed to install archiver${NC}"; exit 1; }
       fi
       
       # Run the script to create the zip
       echo -e "${YELLOW}Creating zip file with Node.js...${NC}"
       node temp_zipper.js "$ZIP_NAME" manifest.json background.js content.js popup.html popup.js styles.css "icons/*" README.md
       rm temp_zipper.js
   else
       echo -e "${RED}No zip utility or Node.js found. Cannot create zip file.${NC}"
       echo -e "${RED}Please install zip or run this script in an environment with zip or Node.js available.${NC}"
       exit 1
   fi
fi

# Create the zip file if we have the zip command
if command -v zip >/dev/null 2>&1; then
   echo -e "\n${YELLOW}Creating extension package...${NC}"
   zip -q -r "$ZIP_NAME" manifest.json background.js content.js popup.html popup.js styles.css icons README.md
   
   if [ $? -eq 0 ]; then
       echo -e "${GREEN}Successfully created: $ZIP_NAME${NC}"
   else
       echo -e "${RED}Failed to create zip file${NC}"
       exit 1
   fi
fi

# Verify the zip file was created
if [ -f "$ZIP_NAME" ]; then
   # Get the size of the zip file
   ZIP_SIZE=$(du -h "$ZIP_NAME" | cut -f1)
   
   echo -e "\n${GREEN}=== Build Summary ===${NC}"
   echo -e "${GREEN}Extension: $NAME v$VERSION${NC}"
   echo -e "${GREEN}Package: $ZIP_NAME${NC}"
   echo -e "${GREEN}Size: $ZIP_SIZE${NC}"
   echo -e "${GREEN}Build completed successfully!${NC}"
   
   # Provide instructions for loading the extension in Chrome
   echo -e "\n${BLUE}=== Installation Instructions ===${NC}"
   echo -e "1. Extract the ZIP file"
   echo -e "2. Open Chrome and navigate to chrome://extensions/"
   echo -e "3. Enable Developer Mode (toggle in top-right)"
   echo -e "4. Click 'Load unpacked' and select the extracted folder"
   echo -e "5. The extension should now be installed and ready to use"
   
   # Add download instructions for GitHub.dev users
   echo -e "\n${YELLOW}=== GitHub.dev Users ===${NC}"
   echo -e "To download the ZIP file from GitHub.dev:"
   echo -e "1. Navigate to your builds directory in the Explorer panel"
   echo -e "2. Right-click on the ZIP file and select 'Download...'"
   echo -e "3. Save the file to your local machine"
else
   echo -e "\n${RED}Failed to find the created zip file. Build may have failed.${NC}"
   exit 1
fi

# GitHub.dev specific instructions
if [ -n "$GITHUB_CODESPACE_NAME" ] || [ -n "$CODESPACE_NAME" ]; then
   echo -e "\n${BLUE}=== GitHub Codespace Detected ===${NC}"
   echo -e "Your extension has been built in a GitHub Codespace."
   echo -e "Remember to commit and push your changes to your repository."
   echo -e "To download the ZIP file, use the Explorer panel in the left sidebar."
fi

echo -e "\n${BLUE}======================================${NC}"
EOF
   
   # Make the script executable
   chmod +x build.sh
   echo -e "${GREEN}Created and made executable: build.sh${NC}"
}

# Create placeholder icons if needed
create_placeholder_icons() {
   echo -e "\n${YELLOW}Setting up placeholder icons...${NC}"
   mkdir -p icons
   
   # Create simple placeholder icons if they don't exist
   for size in 16 48 128; do
       icon_file="icons/icon${size}.png"
       if [ ! -f "$icon_file" ]; then
           echo "Placeholder icon size ${size}x${size}" > "$icon_file"
           echo -e "${YELLOW}Created placeholder for: $icon_file${NC}"
           echo -e "${YELLOW}Remember to replace with actual icon files before publishing${NC}"
       else
           echo -e "${GREEN}Icon already exists: $icon_file${NC}"
       fi
   done
}

# Run all the update functions
update_manifest
update_content_js
update_background_js
update_popup_html
update_popup_js
update_styles_css
update_readme
create_build_script
create_placeholder_icons

echo -e "\n${GREEN}=== Update Complete ===${NC}"
echo -e "${GREEN}All files have been updated for the Claude Knowledge Base Exporter.${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Run ${BLUE}./build.sh${NC} to create the extension package"
echo -e "2. Commit and push your changes to GitHub"
echo -e "3. Load the extension in Chrome from the builds directory"
echo -e "${BLUE}======================================${NC}"