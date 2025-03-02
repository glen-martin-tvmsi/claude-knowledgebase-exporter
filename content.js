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

  // Enhanced debounce method
  debounce(func, wait) {
    let timeout;
    return (...args) => {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // Robust page detection with multiple strategies
  isKnowledgeBasePage() {
    try {
      const detectionStrategies = [
        () => window.location.href.includes('claude.ai/project/'),
        () => !!document.querySelector('[data-testid="project-document-list"]'),
        () => !!document.querySelector('[role="list"] [role="listitem"]'),
        () => {
          const pageTitle = document.title.toLowerCase();
          return pageTitle.includes('project') || pageTitle.includes('documents');
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

  // Add export button
  addExportButton() {
    // Prevent duplicate buttons
    if (document.querySelector('.claude-obsidian-export-btn')) {
      return;
    }

    // Try to find the specific button next to the hamburger menu button
    const targetButton = document.evaluate(
      "/html/body/div[2]/div/div/main/div[2]/div/div/div[1]/button", 
      document, 
      null, 
      XPathResult.FIRST_ORDERED_NODE_TYPE, 
      null
    ).singleNodeValue;

    if (!targetButton) {
      this.log('Could not find target button for export button placement', 'warn');
      return;
    }

    // Create export button
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
      height: ${targetButton.offsetHeight}px;
      vertical-align: top;
    `;

    exportButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent any parent click events
      this.handleExport();
    });

    // Insert the button right after the target button
    targetButton.parentNode.insertBefore(exportButton, targetButton.nextSibling);

    this.log('Export button added successfully next to target button', 'info');
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

  // Placeholder methods (you'll need to implement these fully)
  async handleExport() {
    this.log('Export process started', 'info');
    // Implement full export logic
  }

  findDocumentElements() {
    // Implement document element finding logic
    return [];
  }

  extractDocumentTitle(element) {
    // Implement title extraction
    return 'Untitled Document';
  }

  async extractDocumentContent(element) {
    // Implement content extraction
    return 'No content';
  }

  convertToMarkdown(document) {
    // Implement markdown conversion
    return { name: 'document.md', content: '' };
  }

  showErrorNotification(message) {
    // Implement error notification
    console.error(message);
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