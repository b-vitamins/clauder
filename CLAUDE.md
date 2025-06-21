# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clauder is a Firefox extension that allows users to download all code artifacts from Claude AI conversations as ZIP files. The extension integrates with Claude's chat interface, providing a download button that processes conversation data and creates structured archives.

## Architecture

### Core Components

- **manifest.json**: WebExtension manifest defining permissions, content scripts, and background scripts
- **background.js**: Main processing logic that handles chat data interception, artifact extraction, and ZIP file generation
- **content.js**: Content script that injects UI elements into Claude's chat interface
- **banner.js**: User feedback system for displaying notifications
- **styles.css**: Extension styling that matches Claude's UI aesthetic

### Key Functionality

- **Chat Data Interception**: Uses webRequest API to capture Claude's chat API responses
- **Artifact Processing**: Extracts code artifacts from conversation messages with proper file extensions
- **ZIP Generation**: Creates structured archives with conversation metadata and artifacts
- **UI Integration**: Injects download controls seamlessly into Claude's interface

## Technical Details

### Data Flow
1. Background script intercepts chat API requests from Claude
2. Chat data is stored in browser storage with automatic cleanup (20 most recent chats)
3. Content script provides UI controls for download initiation
4. Background script processes stored data and generates ZIP archives

### File Structure in Generated Archives
```
chat-uuid.zip/
├── README.md
├── chat-info.json
├── messages/
│   ├── conversation.txt
│   └── metadata.json
└── artifacts/
    ├── 01-filename.ext
    ├── 02-filename.ext
    └── metadata.json
```

## Development

### Testing
- Load extension via `about:debugging` in Firefox
- Navigate to Claude chat pages to test functionality
- Use browser console to monitor extension logs

### Building for Production
```bash
zip -r clauder.zip . -x "*.git*" -x "*.DS_Store" -x "README.md"
```

### Key Technologies
- Firefox WebExtensions API (manifest v2)
- JSZip library for archive generation
- Modern JavaScript (ES6+) with async/await
- CSS with dark mode support

## Extension Permissions

- `tabs`: Detect Claude chat pages
- `downloads`: Save ZIP files
- `storage`: Temporarily store chat data
- `webRequest`: Intercept chat API responses
- `claude.ai/*`: Access Claude's interface

## Code Conventions

- Use camelCase for JavaScript variables and functions
- Prefix extension-specific CSS classes with `clauder-`
- Console logs prefixed with `[Clauder]`
- Error handling with user-friendly notifications
- Debounced DOM operations for performance