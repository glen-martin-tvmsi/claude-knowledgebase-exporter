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
