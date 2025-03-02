// Dynamically load JSZip library
function loadJSZip() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('jszip.min.js');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load JSZip library'));
    document.head.appendChild(script);
  });
}

// Enhanced Claude Knowledge Base Exporter Content Script
class ClaudeKnowledgeBaseExporter {
  constructor() {
    this.pageObserver = null;
    this.debugMode = true;
    this.jsZipLoaded = false;
  }

  // Logging method
  log(message, level = 'info') {
    const logLevels = {
      error: console.error,
      warn: console.warn,
      info: console.log,
      debug: console.log
    };
    const logMethod = logLevels[level] || console.log;
    logMethod(`[Claude KB Exporter] ${message}`);
  }

  // Main export method
  async handleExport() {
    try {
      // Ensure JSZip is loaded
      if (!this.jsZipLoaded) {
        await loadJSZip();
        this.jsZipLoaded = true;
      }

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
            
            return { title, content };
          } catch (docError) {
            this.log(`Error processing document ${index}: ${docError.message}`, 'warn');
            return null;
          }
        })
      );

      // Filter valid documents
      const validDocuments = documents.filter(doc => doc !== null);

      if (validDocuments.length === 0) {
        throw new Error('No valid documents could be extracted');
      }

      // Convert to markdown
      const markdownFiles = validDocuments.map(doc => 
        this.convertToMarkdown(doc)
      );

      // Trigger download
      this.downloadMarkdownFiles(markdownFiles);

    } catch (error) {
      this.log(`Export failed: ${error.message}`, 'error');
      alert(`Export Error: ${error.message}`);
    }
  }

  // Download markdown files
  downloadMarkdownFiles(files) {
    const zip = new JSZip();

    // Add files to ZIP
    files.forEach(file => {
      zip.file(file.name, file.content);
    });

    // Generate and download ZIP
    zip.generateAsync({ type: 'blob' })
      .then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `claude_export_${new Date().toISOString().replace(/:/g, '-')}.zip`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.log('Documents exported successfully', 'info');
      })
      .catch(error => {
        this.log(`ZIP generation failed: ${error.message}`, 'error');
        alert('Failed to create export file');
      });
  }

  // Document element selection
  findDocumentElements() {
    const selectorStrategies = [
      '[data-testid="project-document-item"]',
      '[role="listitem"]',
      'div[data-document-id]',
      '.document-list-item'
    ];

    for (const selector of selectorStrategies) {
      const elements = document.querySelectorAll(selector);
      
      if (elements.length > 0) {
        this.log(`Found ${elements.length} documents using selector: ${selector}`, 'debug');
        return Array.from(elements);
      }
    }

    this.log('No document elements found', 'warn');
    return [];
  }

  // Title extraction
  extractDocumentTitle(element) {
    const titleSelectors = [
      '[data-testid="document-title"]',
      'h1',
      'h2',
      '[role="heading"]',
      '.document-title'
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

  // Content extraction
  async extractDocumentContent(element) {
    element.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const contentSelectors = [
      '[data-testid="document-content"]',
      '[role="article"]',
      '.document-content',
      'main',
      'article'
    ];

    for (const selector of contentSelectors) {
      const contentElement = document.querySelector(selector);
      if (contentElement) {
        const content = contentElement.textContent.trim();
        if (content) return content;
      }
    }

    return 'No content could be extracted';
  }

  // Markdown conversion
  convertToMarkdown(document) {
    const markdownContent = `---
title: "${document.title.replace(/"/g, '\\"')}"
date: "${new Date().toISOString()}"
---

${document.content}`;

    const sanitizedFilename = document.title
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim()
      .substring(0, 100) + '.md';

    return {
      name: sanitizedFilename,
      content: markdownContent
    };
  }

  // Add export button
  addExportButton() {
    if (document.querySelector('.claude-obsidian-export-btn')) {
      return;
    }

    const targetButton = document.evaluate(
      "/html/body/div[2]/div/div/main/div[2]/div/div/div[1]/button", 
      document, 
      null, 
      XPathResult.FIRST_ORDERED_NODE_TYPE, 
      null
    ).singleNodeValue;

    if (!targetButton) {
      this.log('Could not find target button', 'warn');
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
      font-size: 14px;
      height: ${targetButton.offsetHeight}px;
      vertical-align: top;
    `;

    exportButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleExport();
    });

    targetButton.parentNode.insertBefore(exportButton, targetButton.nextSibling);
    this.log('Export button added', 'info');
  }

  // Initialize extension
  initialize() {
    this.log('Initializing', 'info');

    // Clean up existing observer
    if (this.pageObserver) {
      this.pageObserver.disconnect();
    }

    // Create new observer
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

  // Page detection
  isKnowledgeBasePage() {
    const detectionStrategies = [
      () => window.location.href.includes('claude.ai/project/'),
      () => !!document.querySelector('[data-testid="project-document-list"]'),
      () => !!document.querySelector('[role="list"] [role="listitem"]')
    ];

    return detectionStrategies.some(strategy => {
      try {
        return strategy();
      } catch {
        return false;
      }
    });
  }

  // Debounce utility
  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
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