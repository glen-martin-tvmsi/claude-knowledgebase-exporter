# Claude Knowledge Base Exporter

A Chrome extension that allows you to export Claude's knowledge base documents to Markdown format for use in Obsidian.

## Features

- Adds an "Export to Obsidian" button to Claude's knowledge base interface
- Extracts all documents and converts them to Markdown format
- Generates a ZIP file containing all documents
- Creates an index file for easy navigation in Obsidian

## Installation

Since this extension is not published to the Chrome Web Store, you'll need to install it in developer mode:

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the folder containing this extension

## Usage

1. Navigate to your Claude knowledge base
2. Look for the "Export to Obsidian" button (usually in the header area)
3. Click the button to start the export process
4. Wait for the export to complete
5. When prompted, save the ZIP file
6. Extract the ZIP file to your Obsidian vault

## Development

This extension is designed to work with Claude's knowledge base interface. If Claude updates their interface, the extension may need to be updated to match the new DOM structure.

The main components are:

- `manifest.json`: Extension configuration
- `content.js`: Script that runs on the Claude website to extract documents
- `background.js`: Script that handles ZIP creation and downloading
- `popup.html` and `popup.js`: Extension popup interface
- `styles.css`: Styles for the export button and status messages

## License

MIT
