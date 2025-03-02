#!/bin/bash

# Create directory structure
mkdir -p icons

# Create placeholder icons (you'll need to replace these with real icons later)
echo "Placeholder for icon" > icons/icon16.png
echo "Placeholder for icon" > icons/icon48.png  
echo "Placeholder for icon" > icons/icon128.png

# Create manifest.json
cat > manifest.json << 'EOF'
{
  "manifest_version": 3,
  "name": "Claude Knowledge Base Exporter",
  "version": "1.0",
  "description": "Export Claude knowledge base documents to Markdown for Obsidian",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "permissions": [
    "activeTab",
    "scripting",
    "downloads"
  ],
  "host_permissions": [
    "https://claude.ai/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["content.js"],
      "css": ["styles.css"]
    }
  ]
}
EOF

# Create background.js
cat > background.js << 'EOF'
// Background script that handles ZIP creation and downloading

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'createAndDownloadZip') {
    // Load JSZip library
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    
    createAndDownloadZip(message.files, sender.tab.id);
    return true; // Keep message channel open for async response
  }
});

// Create ZIP file with extracted documents and download it
async function createAndDownloadZip(files, tabId) {
  try {
    // Create a new ZIP file
    const zip = new JSZip();
    
    // Create a folder for all files
    const folder = zip.folder("claude-knowledge-base");
    
    // Add each file to the ZIP
    files.forEach(file => {
      folder.file(file.name, file.content);
    });
    
    // Create an index file
    const indexContent = [
      '# Claude Knowledge Base Index',
      '',
      'This vault contains all documents exported from Claude Knowledge Base.',
      '',
      '## Documents',
      '',
      ...files.map(file => `- [[${file.name.replace('.md', '')}]]`)
    ].join('\n');
    
    folder.file('00-index.md', indexContent);
    
    // Generate the ZIP file
    const zipBlob = await zip.generateAsync({type: 'blob'});
    
    // Download the ZIP file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    chrome.downloads.download({
      url: URL.createObjectURL(zipBlob),
      filename: `claude-knowledge-base-${timestamp}.zip`,
      saveAs: true
    });
    
    // Notify content script of success
    chrome.tabs.sendMessage(tabId, { 
      action: 'exportComplete', 
      success: true 
    });
  } catch (error) {
    console.error('Failed to create ZIP:', error);
    // Notify content script of failure
    chrome.tabs.sendMessage(tabId, { 
      action: 'exportComplete', 
      success: false, 
      error: error.message 
    });
  }
}
EOF

# Create content.js
cat > content.js << 'EOF'
// Content script that runs on the Claude website

// DOM Observer to detect page changes
let pageObserver;

// Initialize the extension
function initialize() {
  console.log('Claude Knowledge Base Exporter initializing...');
  
  // Stop existing observer if it's running
  if (pageObserver) {
    pageObserver.disconnect();
  }
  
  // Watch for DOM changes to detect when we navigate to a knowledge base page
  pageObserver = new MutationObserver(debounce(checkForKnowledgeBase, 1000));
  pageObserver.observe(document.body, { subtree: true, childList: true });
  
  // Also check immediately
  checkForKnowledgeBase();
}

// Debounce function to prevent excessive checks
function debounce(func, wait) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, arguments), wait);
  };
}

// Check if we're on a knowledge base page
function checkForKnowledgeBase() {
  if (isKnowledgeBasePage()) {
    addExportButton();
  }
}

// Determine if the current page is a knowledge base
function isKnowledgeBasePage() {
  // This needs to be adjusted based on Claude's actual URL and DOM structure
  return window.location.href.includes('claude.ai') && 
         (document.querySelector('[data-testid="knowledge-base"]') || 
          document.querySelector('.knowledge-base') ||
          document.querySelector('.documents-list'));
}

// Add the export button to the page
function addExportButton() {
  // Check if we already added the button
  if (document.querySelector('.claude-obsidian-export-btn')) {
    return;
  }
  
  // Look for a suitable container to add our button
  // These selectors need to be adjusted based on Claude's actual DOM structure
  const container = document.querySelector('.knowledge-base-header') || 
                    document.querySelector('[data-testid="kb-header"]') || 
                    document.querySelector('header');
  
  if (!container) {
    console.log('Claude Knowledge Base Exporter: Could not find suitable container for button');
    return;
  }
  
  // Create our button
  const exportButton = document.createElement('button');
  exportButton.textContent = 'Export to Obsidian';
  exportButton.className = 'claude-obsidian-export-btn';
  exportButton.addEventListener('click', handleExport);
  
  // Add it to the page
  container.appendChild(exportButton);
  
  console.log('Claude Knowledge Base Exporter: Added export button');
}

// Handle the export process when button is clicked
async function handleExport() {
  try {
    // Show a loading indicator
    const statusElement = showStatus('Starting export process...');
    
    // Extract documents
    updateStatus(statusElement, 'Scanning for documents...');
    const documents = await extractDocuments(statusElement);
    
    if (!documents || documents.length === 0) {
      updateStatus(statusElement, 'No documents found. Please make sure you are on a knowledge base page.', false, true);
      return;
    }
    
    updateStatus(statusElement, `Found ${documents.length} documents. Converting to Markdown...`);
    
    // Convert to markdown
    const markdownFiles = documents.map(convertToMarkdown);
    
    updateStatus(statusElement, 'Creating ZIP file...');
    
    // Send to background script to create and download ZIP
    chrome.runtime.sendMessage({
      action: 'createAndDownloadZip',
      files: markdownFiles
    });
    
    // Listen for completion message from background script
    chrome.runtime.onMessage.addListener(function(message) {
      if (message.action === 'exportComplete') {
        if (message.success) {
          updateStatus(statusElement, 'Export complete! ZIP file downloaded.', true);
        } else {
          updateStatus(statusElement, 'Export failed: ' + (message.error || 'Unknown error'), false, true);
        }
      }
    });
  } catch (error) {
    console.error('Export failed:', error);
    showStatus('Export failed: ' + error.message, false, true);
  }
}

// Extract all documents from the page
async function extractDocuments(statusElement) {
  // This function needs to be customized based on Claude's actual structure
  // These are placeholder selectors - you'll need to update them
  const documentElements = document.querySelectorAll('[data-testid="document-item"]') || 
                           document.querySelectorAll('.document-list-item') ||
                           document.querySelectorAll('.kb-document');
  
  if (!documentElements || documentElements.length === 0) {
    console.log('No document elements found');
    return [];
  }
  
  const documents = [];
  let processedCount = 0;
  
  // Process each document
  for (const element of Array.from(documentElements)) {
    try {
      // Update status
      processedCount++;
      updateStatus(statusElement, `Extracting document ${processedCount}/${documentElements.length}...`);
      
      // Extract document data - update these selectors based on actual structure
      const title = element.querySelector('.document-title')?.textContent.trim() || 
                  element.querySelector('[data-testid="document-title"]')?.textContent.trim() ||
                  `Document ${processedCount}`;
      
      // For content, we may need to click the document to view it
      // This is a simplistic approach - may need refinement
      element.click();
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get content - update selector based on actual structure
      const contentElement = document.querySelector('.document-content') ||
                             document.querySelector('[data-testid="document-content"]');
      
      const content = contentElement ? contentElement.textContent.trim() : 'No content available';
      
      // Add to our document list
      documents.push({
        title: title,
        content: content
      });
      
      // Go back to list view if needed
      const backButton = document.querySelector('.back-button') ||
                          document.querySelector('[data-testid="back-button"]');
      if (backButton) {
        backButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Error extracting document ${processedCount}:`, error);
    }
  }
  
  return documents;
}

// Convert a document to markdown format
function convertToMarkdown(document) {
  // Create frontmatter
  const frontmatter = [
    '---',
    `title: "${document.title.replace(/"/g, '\\"')}"`,
    'project: "Claude Knowledge Base"',
    `date: "${new Date().toISOString().split('T')[0]}"`,
    '---',
    ''
  ].join('\n');
  
  // Format content as markdown
  const markdown = document.content;
  
  // Sanitize filename
  const filename = document.title
    .replace(/[\\/:*?"<>|]/g, '_') // Replace invalid filename characters
    .trim()
    .substring(0, 100) // Limit filename length
    + '.md';
  
  return {
    name: filename,
    content: frontmatter + markdown
  };
}

// Show a status message
function showStatus(message, isComplete = false, isError = false) {
  let statusElement = document.querySelector('.claude-export-status');
  
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.className = 'claude-export-status';
    document.body.appendChild(statusElement);
  }
  
  statusElement.textContent = message;
  statusElement.className = 'claude-export-status' + 
    (isComplete ? ' complete' : '') + 
    (isError ? ' error' : '');
  
  if (isComplete || isError) {
    setTimeout(() => {
      statusElement.remove();
    }, 5000);
  }
  
  return statusElement;
}

// Update an existing status element
function updateStatus(element, message, isComplete = false, isError = false) {
  if (!element) return showStatus(message, isComplete, isError);
  
  element.textContent = message;
  
  if (isComplete) element.classList.add('complete');
  if (isError) element.classList.add('error');
  
  if (isComplete || isError) {
    setTimeout(() => {
      element.remove();
    }, 5000);
  }
  
  return element;
}

// Initialize the extension when the page loads
document.addEventListener('DOMContentLoaded', initialize);

// Also run initialize immediately in case the page is already loaded
initialize();
EOF

# Create popup.html
cat > popup.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Claude Knowledge Base Exporter</title>
  <style>
    body {
      width: 300px;
      padding: 15px;
      font-family: Arial, sans-serif;
    }
    h1 {
      font-size: 16px;
      margin-top: 0;
    }
    .instructions {
      font-size: 14px;
      line-height: 1.4;
    }
    .button {
      background: #5c64ef;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
      font-size: 14px;
    }
    .button:hover {
      background: #4a51c4;
    }
  </style>
</head>
<body>
  <h1>Claude Knowledge Base Exporter</h1>
  <div class="instructions">
    <p>This extension allows you to export Claude knowledge base documents to Markdown format for use in Obsidian.</p>
    <p>To use:</p>
    <ol>
      <li>Navigate to your Claude knowledge base</li>
      <li>Click the "Export to Obsidian" button that appears</li>
      <li>Wait for the export to complete</li>
      <li>Extract the ZIP file to your Obsidian vault</li>
    </ol>
  </div>
  <button id="go-to-claude" class="button">Go to Claude</button>
  <script src="popup.js"></script>
</body>
</html>
EOF

# Create popup.js
cat > popup.js << 'EOF'
// Handle popup interactions

document.addEventListener('DOMContentLoaded', function() {
  // Handle the "Go to Claude" button
  document.getElementById('go-to-claude').addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://claude.ai' });
  });
});
EOF

# Create styles.css
cat > styles.css << 'EOF'
/* Styles for the export button and status messages */

.claude-obsidian-export-btn {
  background-color: #5c64ef;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
  font-family: Arial, sans-serif;
}

.claude-obsidian-export-btn:hover {
  background-color: #4a51c4;
}

.claude-export-status {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 20px;
  background-color: #333;
  color: white;
  border-radius: 4px;
  z-index: 10000;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  font-family: Arial, sans-serif;
  font-size: 14px;
}

.claude-export-status.complete {
  background-color: #4CAF50;
}

.claude-export-status.error {
  background-color: #F44336;
}
EOF

# Create README.md
cat > README.md << 'EOF'
# Claude Knowledge Base Exporter

A Chrome extension that allows you to export Claude's knowledge base documents to Markdown format for use in Obsidian.

## Features

- Adds an "Export to Obsidian" button to Claude's knowledge base interface
- Extracts all documents and converts them to Markdown format
- Generates a ZIP file containing all documents
- Creates an index file for easy navigation in Obsidian

## Installation

Since this extension is not published to the Chrome Web Store, you'll need to install it in developer mode:

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the folder containing this extension

## Usage

1. Navigate to your Claude knowledge base
2. Look for the "Export to Obsidian" button (usually in the header area)
3. Click the button to start the export process
4. Wait for the export to complete
5. When prompted, save the ZIP file
6. Extract the ZIP file to your Obsidian vault

## Development

This extension is designed to work with Claude's knowledge base interface. If Claude updates their interface, the extension may need to be updated to match the new DOM structure.

The main components are:

- `manifest.json`: Extension configuration
- `content.js`: Script that runs on the Claude website to extract documents
- `background.js`: Script that handles ZIP creation and downloading
- `popup.html` and `popup.js`: Extension popup interface
- `styles.css`: Styles for the export button and status messages

## License

MIT
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Chrome Extension Development
*.pem
*.crx

# Operating System Files
.DS_Store
Thumbs.db

# Node modules (if you add them later)
node_modules/
EOF

echo "Project setup complete! You'll need to replace the placeholder icons with real ones."
echo "Remember to adjust the selectors in content.js based on Claude's actual DOM structure."