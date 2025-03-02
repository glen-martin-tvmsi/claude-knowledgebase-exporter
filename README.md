# Claude Knowledge Base Exporter

A Chrome extension to export Claude.ai knowledge base documents to Markdown.

## Features

- Automatically detects Claude Knowledge Base / Project pages
- Adds an "Export to Obsidian" button to the interface
- Extracts document titles and content
- Converts to Markdown format with YAML frontmatter
- Packages all documents into a ZIP file named after the project
- Compatible with Obsidian, Logseq, and other Markdown-based knowledge management systems

## Installation

1. Download the latest release ZIP file
2. Extract to a folder on your computer
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked" and select the extracted folder

## Usage

1. Navigate to a Claude Knowledge Base project page (e.g., https://claude.ai/project/...)
2. Click the "Export to Obsidian" button that appears next to other project controls
3. The extension will process all documents and download a ZIP file
4. Extract the ZIP file to your Obsidian vault or other Markdown system

## Project Story

Read the creative origin story of this project in our blog: [The Digital Bards: A Tale of Two Times](/blog/digital_bards.md)

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of JavaScript, HTML, and CSS

### Building

Run the included build script to package the extension:

```bash
chmod +x build.sh
./build.sh
```

### Technical Structure

- `content.js`: Main script that handles document extraction
- `background.js`: Service worker for ZIP creation and download
- `popup.html/js`: User interface for the extension
- `manifest.json`: Extension configuration

## License

MIT License

## Credits

Created with assistance from Claude AI