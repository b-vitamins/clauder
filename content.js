// content.js - Clauder Firefox Extension
console.log('[Clauder] Content script loaded on:', window.location.href);

// Configuration
const CONFIG = {
  maxRetries: 30,
  retryDelay: 500,
  observerThrottle: 100,
  selectors: {
    // More robust selectors based on the actual DOM structure
    inputArea: [
      // Primary: Look for the main input controls container
      '.relative.flex-1.flex.items-center.gap-2',
      // Secondary: Look for the flex row that contains the Research button
      '.flex.flex-row.items-center.gap-2.min-w-0',
      // Tertiary: Look for button containers near input
      '[class*="flex"][class*="items-center"][class*="gap-2"]'
    ],
    researchButton: 'button:has(svg path[d*="M9.5 6.5C9.22386"])',
    toolsButton: 'button[data-testid="input-menu-tools"]',
    attachButton: 'button[data-testid="input-menu-plus"]'
  }
};

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Test function to verify we're on a chat page
function isOnChatPage() {
  return window.location.href.startsWith('https://claude.ai/chat/');
}

// More robust function to find the best placement for our button
function findOptimalButtonPlacement() {
  // Strategy 1: Find the Research button's container
  const researchButton = document.querySelector(CONFIG.selectors.researchButton);
  if (researchButton) {
    // Look for the flex row container that contains the Research button
    const flexRow = researchButton.closest('.flex.flex-row.items-center.gap-2.min-w-0');
    if (flexRow) {
      console.log('[Clauder] Found optimal placement via Research button container');
      return { container: flexRow, position: 'end' };
    }
  }
  
  // Strategy 2: Find the container with the blue toggle (if exists)
  const containers = document.querySelectorAll('.flex.flex-row.items-center.gap-2.min-w-0');
  for (const container of containers) {
    // Check if this container is in the input area (near bottom of viewport)
    const rect = container.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 200 && rect.width > 100) {
      console.log('[Clauder] Found placement via flex row analysis');
      return { container: container, position: 'end' };
    }
  }
  
  // Strategy 3: Create our own container in the main input area
  const mainInputArea = document.querySelector('.relative.flex-1.flex.items-center.gap-2');
  if (mainInputArea) {
    // Check if we need to create a flex row container
    let flexRow = mainInputArea.querySelector('.flex.flex-row.items-center.gap-2.min-w-0');
    if (!flexRow) {
      flexRow = document.createElement('div');
      flexRow.className = 'flex flex-row items-center gap-2 min-w-0';
      mainInputArea.appendChild(flexRow);
      console.log('[Clauder] Created new flex row container');
    }
    return { container: flexRow, position: 'end' };
  }
  
  return null;
}

// Create the download button with exact Claude styling
function createDownloadButton() {
  // Create wrapper div that matches other button wrappers
  const wrapper = document.createElement('div');
  wrapper.className = 'flex shrink-0';
  wrapper.setAttribute('data-state', 'closed');
  wrapper.style.opacity = '1';
  wrapper.style.transform = 'none';
  
  // Create the button
  const button = document.createElement('button');
  button.className = 'clauder-download-button inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-0.5 transition-all h-8 min-w-8 rounded-lg flex items-center px-[7.5px] group !pointer-events-auto !outline-offset-1 text-text-300 border-border-300 active:scale-[0.98] hover:text-text-200/90 hover:bg-bg-100';
  
  // Add download icon matching Claude's icon style - using filled paths like other Claude icons
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="shrink-0">
      <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V40a8,8,0,0,0-16,0v84.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"></path>
    </svg>
  `;
  
  button.setAttribute('type', 'button');
  button.setAttribute('title', 'Download Chat Archive');
  button.setAttribute('aria-label', 'Download Chat Archive');
  button.onclick = handleDownloadClick;
  
  wrapper.appendChild(button);
  return wrapper;
}

// Smarter button addition with better placement logic
function addDownloadButton() {
  // Don't add if already exists
  if (document.querySelector('.clauder-download-button')) {
    return true;
  }
  
  const placement = findOptimalButtonPlacement();
  if (!placement) {
    console.log('[Clauder] Could not find suitable placement for download button');
    return false;
  }
  
  const buttonWrapper = createDownloadButton();
  
  // Add to container based on position preference
  if (placement.position === 'end') {
    placement.container.appendChild(buttonWrapper);
  } else {
    placement.container.insertBefore(buttonWrapper, placement.container.firstChild);
  }
  
  console.log('[Clauder] Download button added successfully');
  return true;
}

// Handle download button click
function handleDownloadClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const url = new URL(window.location.href);
  const uuid = url.pathname.split('/').pop();
  
  console.log('[Clauder] Download clicked, UUID:', uuid);
  
  // Show loading state
  const button = e.currentTarget;
  const originalContent = button.innerHTML;
  button.disabled = true;
  button.style.opacity = '0.6';
  
  // Add spinning animation with filled icon style
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="clauder-spin shrink-0">
      <path d="M136,32V64a8,8,0,0,1-16,0V32a8,8,0,0,1,16,0Zm88,88H192a8,8,0,0,0,0,16h32a8,8,0,0,0,0-16Zm-45.09,47.6a8,8,0,0,0-11.31,11.31l22.62,22.63a8,8,0,0,0,11.32-11.32ZM128,184a8,8,0,0,0-8,8v32a8,8,0,0,0,16,0V192A8,8,0,0,0,128,184ZM77.09,167.6,54.46,190.22a8,8,0,0,0,11.32,11.32L88.4,178.91A8,8,0,0,0,77.09,167.6ZM72,128a8,8,0,0,0-8-8H32a8,8,0,0,0,0,16H64A8,8,0,0,0,72,128ZM65.78,54.46A8,8,0,0,0,54.46,65.78L77.09,88.4A8,8,0,0,0,88.4,77.09Z"></path>
    </svg>
  `;
  
  createToast('Creating archive...', 'info', 2000);
  
  // Store original content for reset
  button.dataset.originalContent = originalContent;
  
  browser.runtime.sendMessage({
    action: 'downloadArtifacts',
    uuid: uuid,
    useDirectoryStructure: false
  });
}

// Create subtle toast notifications
function createToast(message, type = "error", timeout = 4000) {
  // Remove any existing toasts first
  const existingToast = document.querySelector('.clauder-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement("div");
  toast.className = `clauder-toast clauder-toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="clauder-toast-content">
      <div class="clauder-toast-icon">
        ${getToastIcon(type)}
      </div>
      <span class="clauder-toast-message">${message}</span>
    </div>
  `;
  
  // Add to bottom right corner
  document.body.appendChild(toast);
  
  // Trigger entrance animation
  setTimeout(() => toast.classList.add('clauder-toast-show'), 10);

  setTimeout(() => {
    toast.classList.remove('clauder-toast-show');
    setTimeout(() => toast.remove(), 300);
  }, timeout);
}

// Get appropriate icon for toast type
function getToastIcon(type) {
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5z"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>'
  };
  return icons[type] || icons.info;
}

// Reset button state after processing
function resetDownloadButton() {
  const button = document.querySelector('.clauder-download-button');
  if (button && button.dataset.originalContent) {
    button.disabled = false;
    button.style.opacity = '1';
    button.innerHTML = button.dataset.originalContent;
    delete button.dataset.originalContent;
  }
}

// Improved initialization with retry logic
const initializeButton = debounce(() => {
  if (!isOnChatPage()) return;
  
  console.log('[Clauder] Attempting to initialize download button...');
  
  let attempts = 0;
  const tryAddButton = () => {
    if (addDownloadButton()) {
      console.log('[Clauder] Button initialization successful');
    } else if (attempts < CONFIG.maxRetries) {
      attempts++;
      setTimeout(tryAddButton, CONFIG.retryDelay);
    } else {
      console.log('[Clauder] Failed to add button after maximum attempts');
    }
  };
  
  tryAddButton();
}, CONFIG.observerThrottle);

// Enhanced styles with better CSS
function injectStyles() {
  if (document.querySelector('#clauder-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'clauder-styles';
  style.textContent = `
    /* Spinning animation */
    @keyframes clauder-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .clauder-spin {
      animation: clauder-spin 1s linear infinite;
    }
    
    /* Toast animations */
    @keyframes clauder-slideIn {
      from { 
        transform: translateX(100%);
        opacity: 0;
      }
      to { 
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    /* Toast styles */
    .clauder-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 320px;
      pointer-events: none;
    }
    
    .clauder-toast-show {
      transform: translateX(0);
      opacity: 1;
    }
    
    .clauder-toast-content {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(8px);
    }
    
    .clauder-toast-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    
    .clauder-toast-message {
      font-weight: 500;
      line-height: 1.4;
    }
    
    .clauder-toast-error .clauder-toast-content {
      background-color: rgba(239, 68, 68, 0.95);
      color: white;
    }
    
    .clauder-toast-success .clauder-toast-content {
      background-color: rgba(34, 197, 94, 0.95);
      color: white;
    }
    
    .clauder-toast-info .clauder-toast-content {
      background-color: rgba(59, 130, 246, 0.95);
      color: white;
    }
    
    /* Claude-like border */
    .border-0\\.5 {
      border-width: 0.5px;
    }
    
    /* Ensure button maintains size */
    .clauder-download-button {
      flex-shrink: 0;
      min-width: 32px;
    }
    
    /* Better hover state */
    .clauder-download-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .clauder-download-button:active {
      transform: scale(0.98);
    }
  `;
  document.head.appendChild(style);
}

// Message listener
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Clauder] Received message:', request);
  
  switch (request.action) {
    case 'ping':
      sendResponse({ status: 'alive', onChatPage: isOnChatPage() });
      break;
      
    case 'checkAndAddDownloadButton':
      initializeButton();
      break;
      
    case 'artifactsProcessed':
      resetDownloadButton();
      createToast(request.message, request.success ? 'success' : 'error', request.success ? 3000 : 5000);
      break;
      
    case 'testToast':
      createToast(request.message, request.type || 'info', request.timeout || 3000);
      break;
  }
  
  return true;
});

// Smart observer that watches for relevant changes
function setupMutationObserver() {
  let lastCheck = 0;
  
  const observer = new MutationObserver(debounce((mutations) => {
    const now = Date.now();
    if (now - lastCheck < CONFIG.observerThrottle) return;
    lastCheck = now;
    
    // Check if we're on a chat page and button is missing
    if (isOnChatPage() && !document.querySelector('.clauder-download-button')) {
      // Look for signs that the input area has been updated
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any of the added nodes might be input area related
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              // Check if this looks like an input area element
              if (element.matches?.('button, .flex, [class*="input"]') ||
                  element.querySelector?.('button, .flex, [class*="input"]')) {
                console.log('[Clauder] Detected potential input area change');
                initializeButton();
                return;
              }
            }
          }
        }
      }
    }
  }, CONFIG.observerThrottle));
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  return observer;
}

// Navigation observer for SPA changes
function setupNavigationObserver() {
  let lastUrl = location.href;
  
  const checkNavigation = () => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('[Clauder] Navigation detected:', currentUrl);
      
      if (isOnChatPage()) {
        // Remove existing button to prevent duplicates
        const existingButton = document.querySelector('.clauder-download-button');
        if (existingButton) {
          existingButton.closest('.flex.shrink-0')?.remove();
        }
        
        // Re-initialize after a short delay
        setTimeout(initializeButton, 500);
      }
    }
  };
  
  // Use both popstate and a lightweight observer for URL changes
  window.addEventListener('popstate', checkNavigation);
  
  const observer = new MutationObserver(debounce(checkNavigation, 100));
  observer.observe(document.querySelector('head title') || document.head, {
    subtree: true,
    characterData: true,
    childList: true
  });
}

// Initialize everything
function initialize() {
  console.log('[Clauder] Initializing extension...');
  
  injectStyles();
  
  if (isOnChatPage()) {
    // Wait for DOM to stabilize
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeButton, 1000);
      });
    } else {
      setTimeout(initializeButton, 1000);
    }
  }
  
  // Set up observers
  setupMutationObserver();
  setupNavigationObserver();
}

// Start initialization
initialize();
