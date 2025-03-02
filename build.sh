#!/bin/bash

# Ensure script stops on any error
set -e

echo "Building Claude Knowledge Base Exporter Extension..."

# Create build directory
mkdir -p build
mkdir -p build/icons

# Download JSZip library
echo "Downloading JSZip library..."
curl -L https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js -o build/jszip.min.js

# Copy extension files
echo "Copying extension files..."
cp manifest.json build/
cp content.js build/
cp background.js build/
cp popup.html build/
cp popup.js build/

# Generate placeholder icons if they don't exist
echo "Generating icons..."
for size in 16 48 128; do
  if [ ! -f "icons/icon${size}.png" ]; then
    echo "Creating icon${size}.png..."
    # Create a placeholder icon with ImageMagick if available
    if command -v convert &> /dev/null; then
      convert -size ${size}x${size} xc:navy -fill white -gravity center -pointsize $((size/2)) -annotate 0 "CKB" "build/icons/icon${size}.png"
    else
      # If ImageMagick is not available, copy a sample icon if it exists
      if [ -f "sample_icon.png" ]; then
        cp sample_icon.png "build/icons/icon${size}.png"
      else
        echo "Warning: Could not create icon${size}.png. Please add it manually."
      fi
    fi
  else
    cp "icons/icon${size}.png" "build/icons/"
  fi
done

# Create a ZIP file of the extension
echo "Creating ZIP file..."
VERSION=$(grep -o '"version": *"[^"]*"' build/manifest.json | cut -d '"' -f 4)
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
ZIP_NAME="Claude-Knowledge-Base-Exporter-v${VERSION}-${TIMESTAMP}.zip"

(cd build && zip -r "../${ZIP_NAME}" *)

echo "Build completed successfully! Output: ${ZIP_NAME}"
echo ""
echo "Installation instructions:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in the top right)"
echo "3. Click 'Load unpacked' and select the 'build' directory"