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
