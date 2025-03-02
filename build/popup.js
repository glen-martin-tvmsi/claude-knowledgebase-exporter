// Popup script for Claude Knowledge Base Exporter

document.addEventListener('DOMContentLoaded', function() {
  const exportButton = document.getElementById('exportBtn');
  const statusElement = document.getElementById('status');
  
  // Handle export button click
  exportButton.addEventListener('click', async function() {
    try {
      // Find active tab
      const tabs = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      
  
  // Initialize
  checkCurrentPage();
});
      
      if (tabs.length === 0) {
        showStatus('No active tab found', 'error');
        return;
      }
      
      const activeTab = tabs[0];
      
      // Check if we're on Claude.ai
      if (!activeTab.url.includes('claude.ai')) {
        showStatus('Please navigate to a Claude.ai Knowledge Base page first', 'error');
        return;
      }
      
      // Send message to content script
      chrome.tabs.sendMessage(activeTab.id, { action: 'triggerExport' }, function(response) {
        if (chrome.runtime.lastError) {
          showStatus('Error communicating with page: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        if (response && response.success) {
          showStatus('Export started. Please wait for the download...', 'success');
        } else {
          showStatus(response?.error || 'Unknown error', 'error');
        }
      });
      
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  });
  
  // Helper function to show status messages
  function showStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = 'status ' + type;
    statusElement.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 5000);
    }
  }
  
  // Check if we're on a valid Claude page
  async function checkCurrentPage() {
    const tabs = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      
      if (!activeTab.url.includes('claude.ai')) {
        showStatus('Please navigate to Claude.ai to use this extension', 'error');
        exportButton.disabled = true;
      } else if (!activeTab.url.includes('project')) {
        showStatus('Navigate to a Knowledge Base / Project page in Claude.ai', 'error');
        exportButton.disabled = true;
      }
    }
  }