# Starter Prompt for Claude Knowledge Base Exporter

This prompt will help you contribute to or extend the Claude Knowledge Base Exporter project, a Chrome extension for exporting Claude.ai knowledge base documents to Markdown format.

## Project Overview

I'm working on a Chrome extension that extracts documents from Claude AI's knowledge base and exports them as Markdown files for use in tools like Obsidian. The extension should:

1. Detect when the user is on a Claude knowledge base page
2. Add an "Export to Obsidian" button to the UI
3. Extract document titles and content when clicked
4. Package everything into a downloadable ZIP file

## Technical Approach

I need help with JavaScript for Chrome extensions, specifically with:

1. DOM manipulation to find and extract elements from Claude's UI
2. XPath and CSS selectors to target specific content
3. Chrome extension messaging between content scripts and background scripts
4. ZIP file creation and download handling

## Key Development Questions

Here are specific questions I may need help with:

### DOM Selection & Content Extraction
- How can I select document elements in Claude's knowledge base using XPath or CSS selectors?
- What's the best way to extract both title and content from each document?
- How do I handle documents that are hidden behind click actions?

### Chrome Extension Architecture
- What permissions should I include in my manifest.json?
- How should I structure communication between content scripts and background scripts?
- What's the most reliable way to inject buttons into Claude's UI?

### User Experience
- How can I make the extension adapt to changes in Claude's UI?
- What's the best way to show feedback during the export process?
- How should I structure the exported files for maximum compatibility with tools like Obsidian?

### Debugging & Troubleshooting
- Why might my document finder return empty results despite being on the correct page?
- What could cause only partial content to be extracted from documents?
- How can I debug messaging issues between extension components?

## Current Challenges

The main technical challenges I'm facing are:

1. Reliably finding document elements in Claude's dynamic UI
2. Extracting the complete content from documents (not just titles)
3. Handling popup document viewers and multi-page documents
4. Creating a well-named ZIP file that includes project metadata

## Implementation Details

For specific implementation guidance, I need help with:

1. **XPaths for Critical Elements**:
   - Document list items: `/html/body/div[2]/div/div/main/div[2]/div/div/div[2]/ul/li`
   - Document popup content: `/html/body/div[4]/div/div/div[2]`
   - Document title: `/html/body/div[4]/div/div/div[1]/h2`
   - Project name: `/html/body/div[2]/div/div/main/div[1]/div[1]/div[1]/h1/span`

2. **Content Extraction Logic**:
   - How to click to open document popups
   - How to extract text from these popups
   - How to handle closing popups between document extractions

3. **File Organization**:
   - Converting titles to safe filenames
   - Adding frontmatter to Markdown files
   - Preserving markdown formatting from Claude documents

## Code Example Needs

I may ask for examples of:

1. Document finder functions using XPath or DOM traversal
2. Click handling and popup management code
3. Text extraction and Markdown conversion utilities
4. ZIP creation and download functionality
5. Error handling for robust operation

## Repository Information

The project is open-sourced at: https://github.com/glen-martin-tvmsi/claude-knowledgebase-exporter

I welcome contributions to improve document extraction reliability, UI integration, and export formatting.