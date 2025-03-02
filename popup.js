// Handle popup interactions

document.addEventListener('DOMContentLoaded', function() {
  // Handle the "Go to Claude" button
  document.getElementById('go-to-claude').addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://claude.ai' });
  });
});
