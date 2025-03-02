// Enhanced Claude Knowledge Base Exporter Content Script

class ClaudeKnowledgeBaseExporter {
  constructor() {
    this.pageObserver = null;
    this.debugMode = true;
  }

  // Logging method with configurable verbosity
  log(message, level = 'info') {
    if (!this.debugMode && level === 'debug') return;

    const levels = {
      error: console.error,
      warn: console.warn,
      info: console.log,
      debug: console.log
    };

    const colorStyles = {
      error: 'color: red; font-weight: bold',
      warn: 'color: orange',
      info: 'color: blue',
      debug: 'color: gray'
    };

    const logMethod = levels[level] || console.log;
    logMethod(`%c[Claude KB Exporter] ${message}`, colorStyles[level]);
  }

  // Enhanced debounce method
  debounce(func, wait) {
    let timeout;
    return (...args) => {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // Main export method
  async handleExport() {
    try {
      this.log('Export process started', 'info');
      
      // Find document elements with multiple strategies
      let documentElements = this.findDocumentElements();
      
      if (documentElements.length === 0) {
        this.log('No documents found with primary selectors, trying fallback methods', 'info');
        documentElements = this.findDocumentElementsFallback();
        
        if (documentElements.length === 0) {
          throw new Error('No documents found to export');
        }
      }

      this.log(`Found ${documentElements.length} documents`, 'info');

      // Extract and process documents
      const documents = await Promise.all(
        documentElements.map(async (element, index) => {
          try {
            this.log(`Processing document ${index + 1}/${documentElements.length}`, 'debug');
            const title = this.extractDocumentTitle(element);
            const content = await this.extractDocumentContent(element);
            
            this.log(`Extracted document: ${title}`, 'debug');
            return { title, content };
          } catch (docError) {
            this.log(`Error processing document ${index}: ${docError.message}`, 'warn');
            return null;
          }
        })
      );

      // Filter out failed document extractions
      const validDocuments = documents.filter(doc => doc !== null);

      if (validDocuments.length === 0) {
        throw new Error('No valid documents could be extracted');
      }

      // Convert to markdown
      const markdownFiles = validDocuments.map(doc => 
        this.convertToMarkdown(doc)
      );

      // Send to background script for zip creation and download
      chrome.runtime.sendMessage({
        action: 'createAndDownloadZip',
        files: markdownFiles
      }, response => {
        if (chrome.runtime.lastError) {
          this.log(`Message passing error: ${chrome.runtime.lastError.message}`, 'error');
          this.downloadMarkdownFilesDirectly(markdownFiles);
          return;
        }
        
        this.log('Export process completed successfully', 'info');
      });

    } catch (error) {
      this.log(`Export failed: ${error.message}`, 'error');
      alert(`Export Error: ${error.message}`);
    }
  }

  // Fallback direct download method using JSZip
  downloadMarkdownFilesDirectly(files) {
    try {
      // Check if JSZip is available
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not available for direct download');
      }
      
      const zip = new JSZip();
      
      // Add files to zip
      files.forEach(file => {
        zip.file(file.name, file.content);
      });
      
      // Generate and download ZIP
      zip.generateAsync({ type: 'blob' })
        .then(content => {
          const url = URL.createObjectURL(content);
          const link = document.createElement('a');
          link.href = url;
          link.download = `claude_export_${new Date().toISOString().replace(/:/g, '-')}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          this.log('Documents exported directly with JSZip', 'info');
        })
        .catch(error => {
          this.log(`Direct ZIP creation failed: ${error.message}`, 'error');
          alert('Failed to create ZIP file directly');
        });
    } catch (error) {
      this.log(`Direct download fallback failed: ${error.message}`, 'error');
      alert('Export failed. Try refreshing the page and trying again.');
    }
  }

  // Document element selection - primary methods
  findDocumentElements() {
    // Try multiple selector strategies
    const selectorStrategies = [
      // Direct test IDs
      '[data-testid="project-document-item"]',
      '[data-testid="document-list-item"]',
      
      // Generic list items in document context
      '[role="list"] [role="listitem"]',
      
      // Document-specific attributes
      '[data-document-id]',
      '[data-item-type="document"]',
      
      // Class-based selectors
      '.document-item',
      '.document-list-item'
    ];

    for (const selector of selectorStrategies) {
      try {
        const elements = document.querySelectorAll(selector);
        
        if (elements && elements.length > 0) {
          this.log(`Found ${elements.length} documents using selector: ${selector}`, 'debug');
          return Array.from(elements);
        }
      } catch (error) {
        this.log(`Error with selector ${selector}: ${error.message}`, 'debug');
      }
    }

    // Try XPath selectors as a fallback
    const xpathStrategies = [
      "//div[contains(@class, 'document')]",
      "//li[contains(@role, 'listitem')]",
      "//div[contains(@data-testid, 'document')]"
    ];

    for (const xpath of xpathStrategies) {
      try {
        const result = document.evaluate(
          xpath, 
          document, 
          null, 
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
          null
        );
        
        if (result && result.snapshotLength > 0) {
          const elements = [];
          for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i));
          }
          
          this.log(`Found ${elements.length} documents using XPath: ${xpath}`, 'debug');
          return elements;
        }
      } catch (error) {
        this.log(`Error with XPath ${xpath}: ${error.message}`, 'debug');
      }
    }

    this.log('No document elements found with primary selectors', 'warn');
    return [];
  }

  // Fallback document element selection for difficult cases
  findDocumentElementsFallback() {
    this.log('Attempting fallback document selection methods', 'debug');
    
    // Strategy 1: Look for elements with specific text patterns
    try {
      // Find divs that might contain document titles
      const elements = Array.from(document.querySelectorAll('div'))
        .filter(el => {
          const text = el.textContent.trim();
          // Look for div elements that have text but aren't too long (likely titles)
          return text.length > 0 && text.length < 200 && 
                 el.querySelectorAll('div, span').length < 5 &&
                 // Check if it has a click handler (interactive element)
                 (el.onclick || 
                  el.getAttribute('role') === 'button' || 
                  el.className.includes('click'));
        });
      
      if (elements.length > 0) {
        this.log(`Found ${elements.length} potential documents using text pattern matching`, 'debug');
        return elements;
      }
    } catch (error) {
      this.log(`Error in fallback strategy 1: ${error.message}`, 'debug');
    }
    
    // Strategy 2: Navigational approach - find the document list container
    try {
      // Look for containers that might be document lists
      const containers = Array.from(document.querySelectorAll('div[role="list"], ul, ol, div > div > div'))
        .filter(container => {
          // Check if container has child elements that look like list items
          const children = container.children;
          return children.length > 0 && 
                 Array.from(children).some(child => 
                   child.tagName === 'LI' || 
                   child.getAttribute('role') === 'listitem' ||
                   child.className.includes('item')
                 );
        });
      
      for (const container of containers) {
        // Get the direct children that look like list items
        const items = Array.from(container.children)
          .filter(child => 
            child.tagName === 'LI' || 
            child.getAttribute('role') === 'listitem' ||
            child.className.includes('item')
          );
        
        if (items.length > 0) {
          this.log(`Found ${items.length} potential documents in list container`, 'debug');
          return items;
        }
      }
    } catch (error) {
      this.log(`Error in fallback strategy 2: ${error.message}`, 'debug');
    }
    
    // Strategy 3: DOM structure-based approach
    try {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        // Find all divs within main that have a consistent structure
        const potentialLists = Array.from(mainElement.querySelectorAll('div > div > div'))
          .filter(div => {
            const siblingCount = Array.from(div.parentNode.children)
              .filter(child => child.tagName === div.tagName).length;
            return siblingCount > 2; // If there are similar siblings, it might be a list
          });
        
        if (potentialLists.length > 0) {
          this.log(`Found ${potentialLists.length} potential documents using DOM structure analysis`, 'debug');
          return potentialLists;
        }
      }
    } catch (error) {
      this.log(`Error in fallback strategy 3: ${error.message}`, 'debug');
    }
    
    this.log('No documents found even with fallback strategies', 'error');
    return [];
  }

  // Title extraction with multiple fallbacks
  extractDocumentTitle(element) {
    // Try various selectors for title elements
    const titleSelectors = [
      '[data-testid="document-title"]',
      '[data-testid="title"]',
      '[role="heading"]',
      'h1', 'h2', 'h3',
      '.title',
      'span.font-bold',
      'div[style*="font-weight: bold"]'
    ];

    // Try each selector
    for (const selector of titleSelectors) {
      try {
        const titleElement = element.querySelector(selector);
        if (titleElement) {
          const title = titleElement.textContent.trim();
          if (title) {
            this.log(`Found title using selector ${selector}: ${title}`, 'debug');
            return title;
          }
        }
      } catch (error) {
        this.log(`Error finding title with selector ${selector}: ${error.message}`, 'debug');
      }
    }

    // If no title element found, try to extract from the element itself
    try {
      // First, try to find the first text node that's not empty
      const textNodes = Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      
      if (textNodes.length > 0) {
        const text = textNodes[0].textContent.trim();
        if (text) {
          this.log(`Extracted title from text node: ${text}`, 'debug');
          return text;
        }
      }
      
      // Then try the element's own text content
      const text = element.textContent.trim();
      if (text) {
        // Limit to first 50 chars
        const shortenedText = text.length > 50 ? text.substring(0, 47) + '...' : text;
        this.log(`Using element's text content as title: ${shortenedText}`, 'debug');
        return shortenedText;
      }
    } catch (error) {
      this.log(`Error extracting title from element text: ${error.message}`, 'debug');
    }

    // If all else fails, generate a generic title
    const fallbackTitle = `Document ${new Date().toISOString()}`;
    this.log(`Using fallback title: ${fallbackTitle}`, 'debug');
    return fallbackTitle;
  }

  // Content extraction with click handling
  async extractDocumentContent(element) {
    try {
      // Try to click on the element to open the document
      this.log('Clicking element to access content', 'debug');
      
      // Store the current document for comparison
      const currentUrl = window.location.href;
      
      // Click the element
      element.click();
      
      // Wait for content to load or navigation to occur
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if we've navigated to a new page
      if (window.location.href !== currentUrl) {
        this.log('Navigation detected, extracting from new page', 'debug');
        
        // If we navigated, extract from the current page's main content area
        const contentSelectors = [
          '[data-testid="document-content"]',
          '[role="article"]',
          'main',
          'article',
          '.document-content'
        ];
        
        for (const selector of contentSelectors) {
          const contentElement = document.querySelector(selector);
          if (contentElement) {
            const content = contentElement.textContent.trim();
            if (content) {
              return content;
            }
          }
        }
      } else {
        // We didn't navigate, look for a modal or expanded view
        this.log('Looking for modal or expanded content view', 'debug');
        
        const modalSelectors = [
          'div[role="dialog"]',
          '.modal', 
          '.popup',
          '[data-testid="document-modal"]'
        ];
        
        for (const selector of modalSelectors) {
          const modalElement = document.querySelector(selector);
          if (modalElement) {
            const content = modalElement.textContent.trim();
            if (content) {
              return content;
            }
          }
        }
      }
      
      // If we couldn't find content in a modal or after navigation,
      // fall back to the element's own content
      return element.textContent.trim();
      
    } catch (error) {
      this.log(`Error extracting content: ${error.message}`, 'warn');
      // Return the element's text content as a fallback
      return element.textContent.trim();
    }
  }

  // Markdown conversion
  convertToMarkdown(document) {
    try {
      // Create markdown with frontmatter
      const markdownContent = `---
title: "${document.title.replace(/"/g, '\\"')}"
date: "${new Date().toISOString()}"
---

${document.content}`;

      // Sanitize filename - replace problematic characters
      const sanitizedFilename = document.title
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .trim()
        .substring(0, 100) + '.md';

      return {
        name: sanitizedFilename,
        content: markdownContent
      };
    } catch (error) {
      this.log(`Error converting to markdown: ${error.message}`, 'warn');
      // Create a fallback markdown file
      return {
        name: `document_${Date.now()}.md`,
        content: document.content || 'Empty document'
      };
    }
  }

  // Add export button with more robust target finding
  addExportButton() {
    // Check if button already exists
    if (document.querySelector('.claude-obsidian-export-btn')) {
      return;
    }

    // Try to find a good target button or location
    const targetStrategies = [
      // XPath approach
      () => document.evaluate(
        "/html/body/div[2]/div/div/main/div[2]/div/div/div[1]/button", 
        document, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
      ).singleNodeValue,
      
      // Query selector approaches
      () => document.querySelector('[data-testid="project-header"] button'),
      () => document.querySelector('main header button'),
      () => document.querySelector('main nav button'),
      
      // General button in the header area
      () => {
        const buttons = Array.from(document.querySelectorAll('button'))
          .filter(button => {
            const rect = button.getBoundingClientRect();
            return rect.top < 100; // Likely in the header
          });
        return buttons.length > 0 ? buttons[0] : null;
      }
    ];

    // Try each strategy to find a target
    let targetButton = null;
    for (const strategy of targetStrategies) {
      try {
        targetButton = strategy();
        if (targetButton) {
          this.log(`Found target button using strategy ${strategy.name || 'anonymous'}`, 'debug');
          break;
        }
      } catch (error) {
        this.log(`Error in button target strategy: ${error.message}`, 'debug');
      }
    }

    if (!targetButton) {
      this.log('Could not find target button, creating floating button', 'warn');
      // Create a floating button if no target is found
      const floatingButton = document.createElement('button');
      floatingButton.textContent = 'Export to Obsidian';
      floatingButton.className = 'claude-obsidian-export-btn';
      floatingButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        padding: 10px 15px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      `;

      floatingButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleExport();
      });

      document.body.appendChild(floatingButton);
      this.log('Added floating export button', 'info');
      return;
    }

    // Create normal export button
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export to Obsidian';
    exportButton.className = 'claude-obsidian-export-btn';
    exportButton.style.cssText = `
      margin-left: 10px;
      padding: 5px 10px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      height: ${targetButton.offsetHeight || 30}px;
      vertical-align: middle;
    `;

    exportButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleExport();
    });

    // Insert the button
    targetButton.parentNode.insertBefore(exportButton, targetButton.nextSibling);
    this.log('Export button added successfully', 'info');
  }

  // Page detection
  isKnowledgeBasePage() {
    const detectionStrategies = [
      // URL-based detection
      () => window.location.href.includes('claude.ai/project/'),
      () => window.location.href.includes('claude.ai/kb/'),
      () => window.location.href.includes('documents'),
      
      // Element-based detection
      () => !!document.querySelector('[data-testid="project-document-list"]'),
      () => !!document.querySelector('[role="list"] [role="listitem"]'),
      
      // Title-based detection
      () => {
        const title = document.title.toLowerCase();
        return title.includes('knowledge') || 
               title.includes('document') || 
               title.includes('project');
      }
    ];

    // Try each strategy
    for (const strategy of detectionStrategies) {
      try {
        if (strategy()) {
          return true;
        }
      } catch (error) {
        this.log(`Error in page detection strategy: ${error.message}`, 'debug');
      }
    }

    return false;
  }

  // Initialize extension
  initialize() {
    this.log('Claude Knowledge Base Exporter initializing', 'info');

    // Clean up existing observer
    if (this.pageObserver) {
      this.pageObserver.disconnect();
    }

    // Create new observer with enhanced detection
    this.pageObserver = new MutationObserver(
      this.debounce(() => {
        if (this.isKnowledgeBasePage()) {
          this.addExportButton();
        }
      }, 1000)
    );

    this.pageObserver.observe(document.body, { 
      subtree: true, 
      childList: true 
    });

    // Initial check
    if (this.isKnowledgeBasePage()) {
      this.addExportButton();
    }
  }
}

// Instantiate and initialize
const exporter = new ClaudeKnowledgeBaseExporter();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  try {
    exporter.initialize();
  } catch (error) {
    console.error('Initialization failed:', error);
  }
});

// Also run initialize immediately
try {
  exporter.initialize();
} catch (error) {
  console.error('Immediate initialization failed:', error);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'triggerExport') {
    try {
      exporter.handleExport();
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});