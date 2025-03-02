// Background Service Worker for Claude Knowledge Base Exporter

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createAndDownloadZip') {
    handleZipCreation(request.files, request.projectName)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('Error creating ZIP:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate async response
    return true;
  }
});

// Create and download ZIP file
async function handleZipCreation(files, projectName = '') {
  try {
    // Create a new JSZip instance
    const JSZip = await importJSZip();
    const zip = new JSZip();
    
    // Add files to the ZIP
    files.forEach(file => {
      zip.file(file.name, file.content);
    });
    
    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Create a download
    const timestamp = new Date().toISOString().split('T')[0];
    const zipName = projectName 
      ? `${projectName}_${timestamp}.zip`
      : `claude_export_${timestamp}.zip`;
    
    await chrome.downloads.download({
      url: URL.createObjectURL(zipBlob),
      filename: zipName,
      saveAs: true
    });
    
    console.log('ZIP file created and download initiated');
    
  } catch (error) {
    console.error('ZIP creation failed:', error);
    throw error;
  }
}

// Import JSZip library
async function importJSZip() {
  return new Promise((resolve, reject) => {
    try {
      // Check if JSZip is already defined
      if (typeof JSZip !== 'undefined') {
        return resolve(JSZip);
      }
      
      // Dynamically import JSZip
      importScripts('jszip.min.js');
      
      if (typeof JSZip !== 'undefined') {
        resolve(JSZip);
      } else {
        reject(new Error('Failed to load JSZip library'));
      }
    } catch (error) {
      reject(error);
    }
  });
}