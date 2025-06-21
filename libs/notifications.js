// notification.js - Clauder notification system

// Show notification
function showNotification(type, message) {
  // Remove any existing notifications
  document.querySelectorAll('.clauder-notification').forEach(el => el.remove());
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `clauder-notification clauder-notification-${type}`;
  
  // Create content wrapper
  const content = document.createElement('div');
  content.className = 'clauder-notification-content';
  
  // Add icon
  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'clauder-notification-icon';
  iconWrapper.innerHTML = getNotificationIcon(type);
  
  // Add message
  const messageEl = document.createElement('div');
  messageEl.className = 'clauder-notification-message';
  messageEl.textContent = message;
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'clauder-notification-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => notification.remove();
  
  // Assemble notification
  content.appendChild(iconWrapper);
  content.appendChild(messageEl);
  notification.appendChild(content);
  notification.appendChild(closeBtn);
  
  // Add to page
  document.body.appendChild(notification);
  
  // Trigger animation
  requestAnimationFrame(() => {
    notification.classList.add('clauder-notification-show');
  });
  
  // Auto-dismiss after delay
  const duration = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    notification.classList.remove('clauder-notification-show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Get icon for notification type
function getNotificationIcon(type) {
  const icons = {
    success: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    
    error: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 10L3 3m7 7l7 7m-7-7L3 17m7-7l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    
    warning: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 7v4m0 4h.01M8.866 3.5l-6.928 12A2 2 0 003.67 18h12.66a2 2 0 001.732-3L11.134 3.5a2 2 0 00-3.464 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    
    info: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 10v6m0-10h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  };
  
  return icons[type] || icons.info;
}
