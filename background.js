// background.js - Clauder Firefox Extension (Revised)
console.log('[Clauder] Background script loaded - v3.0');

// Store for request headers (temporary, cleared after use)
const pendingRequests = new Map();

// Test communication with content script
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.startsWith('https://claude.ai/chat/')) {
    console.log('[Clauder] Tab navigated to Claude chat:', changeInfo.url);
    
    // Give content script time to load
    setTimeout(async () => {
      try {
        await browser.tabs.sendMessage(tabId, { action: 'checkAndAddDownloadButton' });
      } catch (error) {
        console.log('[Clauder] Content script not ready:', error.message);
      }
    }, 500);
  }
});

// Handle messages from content script
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('[Clauder] Background received message:', request, 'from tab:', sender.tab?.id);
  
  if (request.action === 'downloadArtifacts') {
    console.log('[Clauder] Download request received for UUID:', request.uuid);
    
    // Check if we have chat data for this UUID
    const chatKey = `chat_${request.uuid}`;
    const result = await browser.storage.local.get(chatKey);
    
    if (result[chatKey]) {
      console.log('[Clauder] Found chat data in storage!');
      // Process and create complete archive
      processAndDownloadArchive(result[chatKey], sender.tab.id);
    } else {
      console.log('[Clauder] No chat data found in storage');
      browser.tabs.sendMessage(sender.tab.id, {
        action: 'artifactsProcessed',
        success: false,
        message: 'No chat data found. Try refreshing the page.'
      });
    }
  }
  
  return true;
});

// Clean filename function
function cleanFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s\-\.]/g, '-') // Replace special chars with hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .trim();
}

// Function to extract text content from message content array
function extractMessageText(contentArray) {
  if (!contentArray || !Array.isArray(contentArray)) return '';
  
  let text = '';
  contentArray.forEach(item => {
    if (item.type === 'text' && item.text) {
      text += item.text + '\n';
    } else if (item.type === 'tool_use' && item.name === 'artifacts') {
      // Add artifact reference in message
      const input = item.input;
      if (input.title) {
        text += `\n[Artifact: ${input.title}]\n`;
      }
    }
  });
  
  return text.trim();
}

// Function to format messages for export
function formatMessagesForExport(messages) {
  const sortedMessages = messages
    .filter(m => m.content && m.sender) // Only messages with content
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  let formatted = '';
  let messageIndex = 1;
  
  // Build conversation thread
  const processMessage = (messageId, depth = 0) => {
    const message = messages.find(m => m.uuid === messageId);
    if (!message || !message.content) return;
    
    const indent = '  '.repeat(depth);
    const timestamp = new Date(message.created_at).toLocaleString();
    const sender = message.sender === 'human' ? 'User' : 'Claude';
    const text = extractMessageText(message.content);
    
    if (text) {
      formatted += `${indent}[${messageIndex}] ${sender} (${timestamp}):\n`;
      formatted += text.split('\n').map(line => `${indent}${line}`).join('\n');
      formatted += '\n\n';
      messageIndex++;
    }
    
    // Process child messages
    const children = messages.filter(m => m.parent_message_uuid === messageId);
    children.forEach(child => processMessage(child.uuid, depth));
  };
  
  // Start from root messages
  const rootMessages = messages.filter(m => 
    m.parent_message_uuid === '00000000-0000-4000-8000-000000000000'
  );
  rootMessages.forEach(root => processMessage(root.uuid));
  
  return formatted;
}

// Function to extract artifacts from message content array
function extractArtifacts(contentArray) {
  if (!contentArray || !Array.isArray(contentArray)) return [];
  
  const artifactMap = new Map();
  let artifactCounter = 0;
  
  contentArray.forEach(item => {
    if (item.type === 'tool_use' && item.name === 'artifacts' && item.input) {
      const input = item.input;
      
      if ((input.command === 'create' || input.command === 'update') && input.content) {
        const artifactId = input.id || `artifact_${artifactCounter++}`;
        
        // Determine language/extension
        let language = 'txt';
        let extension = '.txt';
        
        if (input.type === 'application/vnd.ant.code' && input.language) {
          language = input.language;
          extension = getFileExtension(input.language);
        } else if (input.type === 'text/html') {
          language = 'html';
          extension = '.html';
        } else if (input.type === 'application/vnd.ant.react') {
          language = 'jsx';
          extension = '.jsx';
        } else if (input.type === 'text/css') {
          language = 'css';
          extension = '.css';
        } else if (input.type === 'text/javascript') {
          language = 'javascript';
          extension = '.js';
        } else if (input.type === 'text/markdown') {
          language = 'markdown';
          extension = '.md';
        }
        
        artifactMap.set(artifactId, {
          content: input.content,
          title: input.title || 'untitled',
          type: input.type || 'text/plain',
          language: language,
          extension: extension,
          id: artifactId
        });
      }
    }
  });
  
  return Array.from(artifactMap.values());
}

// Function to get file extension from language
function getFileExtension(language) {
  const languageToExt = {
    'javascript': '.js',
    'typescript': '.ts',
    'python': '.py',
    'java': '.java',
    'cpp': '.cpp',
    'c': '.c',
    'csharp': '.cs',
    'go': '.go',
    'rust': '.rs',
    'ruby': '.rb',
    'php': '.php',
    'swift': '.swift',
    'kotlin': '.kt',
    'scala': '.scala',
    'r': '.r',
    'matlab': '.m',
    'html': '.html',
    'css': '.css',
    'scss': '.scss',
    'json': '.json',
    'xml': '.xml',
    'yaml': '.yaml',
    'sql': '.sql',
    'shell': '.sh',
    'bash': '.sh',
    'markdown': '.md',
    'jsx': '.jsx',
    'tsx': '.tsx',
    'vue': '.vue'
  };
  
  return languageToExt[language?.toLowerCase()] || '.txt';
}

// Function to create chat metadata
function createChatMetadata(chatData) {
  const metadata = {
    chat_id: chatData.uuid,
    chat_name: chatData.name || 'Untitled Chat',
    created_at: chatData.created_at,
    updated_at: chatData.updated_at,
    exported_at: new Date().toISOString(),
    message_count: chatData.chat_messages.length,
    artifact_count: 0, // Will be updated
    export_version: '1.0',
    source: 'Clauder Firefox Extension'
  };
  
  return metadata;
}

// Main function to process and create complete archive
async function processAndDownloadArchive(chatData, tabId) {
  try {
    console.log('[Clauder] Creating complete chat archive...');
    
    // Create ZIP file
    const zip = new JSZip();
    
    // Process all artifacts
    const globalArtifactMap = new Map();
    
    chatData.chat_messages.forEach(message => {
      if (message.sender === 'assistant' && message.content && Array.isArray(message.content)) {
        const artifacts = extractArtifacts(message.content);
        artifacts.forEach(artifact => {
          globalArtifactMap.set(artifact.id, artifact);
        });
      }
    });
    
    // Create metadata
    const metadata = createChatMetadata(chatData);
    metadata.artifact_count = globalArtifactMap.size;
    
    // Add metadata files at root
    zip.file('chat-info.json', JSON.stringify(metadata, null, 2));
    
    // Add README
    const readme = `# ${metadata.chat_name}

## Chat Information
- ID: ${metadata.chat_id}
- Created: ${new Date(metadata.created_at).toLocaleString()}
- Updated: ${new Date(metadata.updated_at).toLocaleString()}
- Exported: ${new Date(metadata.exported_at).toLocaleString()}

## Contents
- Messages: ${metadata.message_count}
- Artifacts: ${metadata.artifact_count}

## Structure
- /messages/ - Contains the full conversation history
- /artifacts/ - Contains all code artifacts (if any)
- chat-info.json - Metadata about this chat
- README.md - This file

Exported using Clauder Firefox Extension v${metadata.export_version}
`;
    zip.file('README.md', readme);
    
    // Add messages folder
    const formattedMessages = formatMessagesForExport(chatData.chat_messages);
    zip.file('messages/conversation.txt', formattedMessages);
    
    // Add message metadata
    const messageMetadata = {
      total_messages: chatData.chat_messages.length,
      participants: ['User', 'Claude'],
      exported_format: 'plain_text',
      encoding: 'utf-8'
    };
    zip.file('messages/metadata.json', JSON.stringify(messageMetadata, null, 2));
    
    // Add artifacts if any exist
    if (globalArtifactMap.size > 0) {
      const usedNames = new Set();
      let index = 1;
      
      globalArtifactMap.forEach(artifact => {
        // Clean up the title for filename
        let baseName = cleanFilename(artifact.title);
        
        // Remove extension if already in title
        const titleExtensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.md', '.txt', '.py'];
        titleExtensions.forEach(ext => {
          if (baseName.endsWith(ext.substring(1))) {
            baseName = baseName.slice(0, -ext.length + 1);
          }
        });
        
        // Build filename with padding
        let fileName = `${String(index).padStart(2, '0')}-${baseName}${artifact.extension}`;
        
        // Handle duplicates
        let finalName = fileName;
        let counter = 1;
        while (usedNames.has(finalName)) {
          const parts = fileName.split('.');
          const ext = parts.pop();
          const base = parts.join('.');
          finalName = `${base}-${counter}.${ext}`;
          counter++;
        }
        
        usedNames.add(finalName);
        zip.file(`artifacts/${finalName}`, artifact.content);
        console.log(`[Clauder] Added artifact: ${finalName}`);
        index++;
      });
      
      // Add artifacts metadata
      const artifactsList = Array.from(globalArtifactMap.values()).map((artifact, idx) => ({
        filename: Array.from(usedNames)[idx],
        original_title: artifact.title,
        type: artifact.type,
        language: artifact.language
      }));
      
      zip.file('artifacts/metadata.json', JSON.stringify({
        total_artifacts: globalArtifactMap.size,
        artifacts: artifactsList
      }, null, 2));
    }
    
    // Generate ZIP as blob
    const blob = await zip.generateAsync({ type: 'blob' });
    
    // Create object URL for download
    const url = URL.createObjectURL(blob);
    
    // Build filename: use full UUID for guaranteed uniqueness
    const fileName = `${chatData.uuid}.zip`;
    
    browser.downloads.download({
      url: url,
      filename: fileName,
      saveAs: true
    }).then(downloadId => {
      console.log('[Clauder] Download started:', downloadId);
      
      // Clean up object URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      
      // Send success message
      const message = globalArtifactMap.size > 0 
        ? `Archive created with ${metadata.message_count} messages and ${globalArtifactMap.size} artifacts!`
        : `Archive created with ${metadata.message_count} messages!`;
        
      browser.tabs.sendMessage(tabId, {
        action: 'artifactsProcessed',
        success: true,
        message: message
      });
    }).catch(error => {
      console.error('[Clauder] Download error:', error);
      browser.tabs.sendMessage(tabId, {
        action: 'artifactsProcessed',
        success: false,
        message: 'Failed to download archive: ' + error.message
      });
    });
    
  } catch (error) {
    console.error('[Clauder] Processing error:', error);
    browser.tabs.sendMessage(tabId, {
      action: 'artifactsProcessed',
      success: false,
      message: 'Error creating archive: ' + error.message
    });
  }
}

// Function to check if this is our own request
function isOurRequest(headers) {
  return headers?.some(h => h.name === 'X-Clauder-Request' && h.value === 'true');
}

// Function to clean up old chat data (keep only 20 most recent)
async function cleanupOldChats() {
  try {
    const storage = await browser.storage.local.get();
    const chatEntries = Object.entries(storage)
      .filter(([key]) => key.startsWith('chat_'))
      .map(([key, value]) => ({
        key,
        timestamp: new Date(value.updated_at || value.created_at || value.stored_at || 0).getTime()
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Sort newest first
    
    if (chatEntries.length > 20) {
      const keysToRemove = chatEntries.slice(20).map(entry => entry.key);
      await browser.storage.local.remove(keysToRemove);
      console.log(`[Clauder] Cleaned up ${keysToRemove.length} old chats`);
    }
  } catch (error) {
    console.error('[Clauder] Cleanup error:', error);
  }
}

// Function to store chat data
async function storeChatData(data) {
  if (!data.uuid || !data.chat_messages) {
    console.error('[Clauder] Invalid chat data - missing uuid or messages');
    return;
  }
  
  const chatKey = `chat_${data.uuid}`;
  
  try {
    await browser.storage.local.set({
      [chatKey]: {
        uuid: data.uuid,
        name: data.name || 'Untitled Chat',
        created_at: data.created_at,
        updated_at: data.updated_at,
        chat_messages: data.chat_messages,
        stored_at: new Date().toISOString()
      }
    });
    
    console.log(`[Clauder] ✅ Stored chat data for: ${data.uuid}`);
    console.log(`[Clauder] Chat name: ${data.name || 'Untitled'}`);
    
    // Clean up old chats
    await cleanupOldChats();
  } catch (error) {
    console.error('[Clauder] Storage error:', error);
  }
}

// Function to make parallel fetch
async function fetchChatData(url, headers) {
  console.log('[Clauder] Making parallel fetch to:', url);
  
  const headerObj = {};
  headers.forEach(h => {
    if (!['Host', 'Content-Length', 'Connection'].includes(h.name)) {
      headerObj[h.name] = h.value;
    }
  });
  
  headerObj['X-Clauder-Request'] = 'true';
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headerObj,
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error('[Clauder] Fetch failed:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('[Clauder] ✅ Successfully fetched chat data!');
    await storeChatData(data);
    
  } catch (error) {
    console.error('[Clauder] Fetch error:', error);
  }
}

// Listen for Claude's chat API requests
browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (isOurRequest(details.requestHeaders)) {
      console.log('[Clauder] Skipping our own request');
      return;
    }
    
    if (details.url.includes('chat_conversations') && 
        details.url.includes('tree=True') && 
        details.method === 'GET') {
      console.log('[Clauder] ✅ Chat data request detected!');
      fetchChatData(details.url, details.requestHeaders);
    }
  },
  { urls: ["https://claude.ai/api/*"] },
  ["requestHeaders"]
);
