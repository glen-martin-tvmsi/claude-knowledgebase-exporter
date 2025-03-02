// Enhanced Claude Knowledge Base Exporter Content Script

class ClaudeKnowledgeBaseExporter {
  constructor() {
    this.pageObserver = null;
    this.debugMode = true; // Enable detailed logging
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

  // Enhanced debounce with error handling
  debounce(func, wait) {
    let timeout;
    return (...args) => {
      try {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      } catch (error) {
        this.log(`Debounce error: ${error.message}`, 'error');
      }
    };
  }

  // Robust page detection with multiple strategies
  isKnowledgeBasePage() {
    try {
      const detectionStrategies = [
        () => window.location.href.includes('claude.ai'),
        () => !!document.querySelector('[data-testid="knowledge-base"]'),
        () => !!document.querySelector('.knowledge-base'),
        () => !!document.querySelector('.documents-list'),
        () => {
          // More advanced detection if needed
          const pageTitle = document.title.toLowerCase();
          return pageTitle.includes('knowledge base') || pageTitle.includes('documents');
        }
      ];

      const result = detectionStrategies.some(strategy => {
        try {
          return strategy();
        } catch (strategyError) {
          this.log(`Detection strategy failed: ${strategyError.message}`, 'debug');
          return false;
        }
      });

      this.log(`Knowledge base page detection result: ${result}`, 'debug');
      return result;
    } catch (error) {
      this.log(`Page detection error: ${error.message}`, 'error');
      return false;
    }
  }

  // More robust document element selection
  findDocumentElements() {
    const selectorStrategies = [
      '[data-testid="document-item"]',
      '.document-list-item',
      '.kb-document',
      '[role="listitem"] .document-card',
      'div[data-state="closed"] > div'
    ];

    for (const selector of selectorStrategies) {
      const elements = document.querySelectorAll(selector);
      this.log(`Trying selector: ${selector}, Found: ${elements.length}`, 'debug');
      
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }

    this.log('No document elements found using any strategy', 'warn');
    return [];
  }

  // Advanced content extraction with multiple fallback methods
  async extractDocumentContent(element) {
    const extractionStrategies = [
      // Strategy 1: Direct text content
      () => {
        const textElements = element.querySelectorAll('p, h1, h2, h3, span');
        return Array.from(textElements)
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0)
          .join('\n\n');
      },
      
      // Strategy 2: Data attributes
      () => {
        const contentAttr = element.getAttribute('data-content') || 
                             element.getAttribute('data-document-content');
        return contentAttr || '';
      },
      
      // Strategy 3: Aria labels
      () => {
        const ariaLabel = element.getAttribute('aria-label');
        return ariaLabel || '';
      }
    ];

    for (const strategy of extractionStrategies) {
      try {
        const content = strategy();
        if (content && content.length > 10) {
          return content;
        }
      } catch (error) {
        this.log(`Content extraction strategy failed: ${error.message}`, 'debug');
      }
    }

    return 'No content could be extracted';
  }

  // Title extraction with multiple fallback methods
  extractDocumentTitle(element) {
    const titleSelectors = [
      '[data-testid="document-title"]',
      '.document-title',
      'h1',
      'h2',
      '[aria-label]'
    ];

    for (const selector of titleSelectors) {
      const titleElement = element.querySelector(selector);
      if (titleElement) {
        const title = titleElement.textContent.trim();
        if (title) return title;
      }
    }

    return `Untitled Document ${Date.now()}`;
  }

  // Convert document to markdown with enhanced frontmatter
  convertToMarkdown(document) {
    const frontmatter = [
      '---',
      `title: "${document.title.replace(/"/g, '\\"')}"`,
      'project: "Claude Knowledge Base"',
      `date: "${new Date().toISOString()}"`,
      'tags:',
      '  - exported',
      '  - claude-ai',
      '---',
      '',
      document.content
    ].join('\n');

    const sanitizedFilename = document.title
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim()
      .substring(0, 100) + '.md';

    return {
      name: sanitizedFilename,
      content: frontmatter
    };
  }

  // Main export handler with comprehensive error management
  async handleExport() {
    try {
      this.log('Export process started', 'info');
      
      // Find document elements
      const documentElements = this.findDocumentElements();
      
      if (documentElements.length === 0) {
        throw new Error('No documents found to export');
      }

      this.log(`Found ${documentElements.length} documents`, 'info');

      // Extract and process documents
      const documents = await Promise.all(
        documentElements.map(async (element, index) => {
          try {
            const title = this.extractDocumentTitle(element);
            const content = await this.extractDocumentContent(element);
            
            this.log(`Processed document: ${title}`, 'debug');
            
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

      // Send to background script
      chrome.runtime.sendMessage({
        action: 'createAndDownloadZip',
        files: markdownFiles
      }, response => {
        if (chrome.runtime.lastError) {
          this.log(`Message passing error: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        
        this.log('Export process completed successfully', 'info');
      });

    } catch (error) {
      this.log(`Export failed: ${error.message}`, 'error');
      // Optionally show user-friendly error notification
      this.showErrorNotification(error.message);
    }
  }

  // User-friendly error notification
  showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: #ff4d4f;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    notification.textContent = `Export Error: ${message}`;
    document.body.appendChild(notification);

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 5000);
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

  // Add export button with improved positioning
  addExportButton() {
    // Prevent duplicate buttons
    if (document.querySelector('.claude-obsidian-export-btn')) {
      return;
    }

    const possibleContainers = [
      '.knowledge-base-header',
      '[data-testid="kb-header"]',
      'header',
      '.app-header',
      'nav'
    ];

    let container = null;
    for (const selector of possibleContainers) {
      container = document.querySelector(selector);
      if (container) break;
    }

    if (!container) {
      this.log('Could not find suitable container for export button', 'warn');
      return;
    }

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
    `;

    exportButton.addEventListener('click', () => this.handleExport());
    container.appendChild(exportButton);

    this.log('Export button added successfully', 'info');
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