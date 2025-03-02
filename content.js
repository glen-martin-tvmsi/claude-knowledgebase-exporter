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

  // Existing method definitions...

  // Consolidated and corrected handleExport method
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
      this.showErrorNotification(error.message);
    }
  }

  // Existing other methods...

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