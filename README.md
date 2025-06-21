# Clauder

Firefox extension to download artifacts from Claude AI conversations as ZIP files.

## Features

- Download all code artifacts from Claude conversations
- Extracts artifacts with appropriate file extensions
- Creates structured ZIP archives with conversation metadata
- Processes nested conversation threads
- Handles file naming conflicts
- Toast notifications for user feedback

## Installation

### Development Installation
1. Clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on"
5. Select `manifest.json` from the cloned directory

## Usage

1. Navigate to a Claude chat conversation at `claude.ai/chat/*`
2. Look for the download button in the message input area
3. Click the download button to create and download a ZIP archive of all artifacts

## Archive Structure

Downloaded archives contain:
```
chat-uuid.zip/
├── README.md              # Chat information
├── chat-info.json         # Metadata
├── messages/
│   ├── conversation.txt   # Full conversation
│   └── metadata.json      # Message metadata
└── artifacts/             # Code artifacts (if any)
    ├── 01-filename.ext
    └── metadata.json
```

## Development

### Building for Distribution
```bash
zip -r clauder.zip . -x "*.git*" -x "*.DS_Store" -x "README.md"
```

### Technologies
- Firefox WebExtensions API (manifest v2)
- JSZip for archive generation
- JavaScript ES6+

## Privacy

- All processing happens locally in your browser
- No data is sent to external servers
- Chat data is temporarily stored in browser storage
- Only the 20 most recent chats are kept in storage

## Permissions

- `tabs`: Detect Claude chat pages
- `downloads`: Save ZIP files
- `storage`: Temporarily store chat data
- `webRequest`: Intercept chat data for processing
- `claude.ai/*`: Inject UI and access chat content

## License

MIT License - see [LICENSE](LICENSE) file for details
