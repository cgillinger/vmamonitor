// Acknowledge alerts to prevent auto-popup
async function acknowledgeAlerts() {
  try {
    // Get current active and acknowledged alerts
    const { activeAlerts = [], acknowledgedAlerts = [] } = 
      await chrome.storage.local.get(['activeAlerts', 'acknowledgedAlerts']);
    
    // Add current severe alert IDs to acknowledged list
    const severeAlertIds = activeAlerts
      .filter(alert => {
        if (!alert.info || alert.info.length === 0) return false;
        return alert.info.some(info => 
          info.severity === 'Extreme' || info.severity === 'Severe'
        );
      })
      .map(alert => alert.identifier);
    
    // Create new list with unique IDs
    const newAcknowledgedAlerts = [...new Set([...acknowledgedAlerts, ...severeAlertIds])];
    
    // Save to storage
    await chrome.storage.local.set({ acknowledgedAlerts: newAcknowledgedAlerts });
    
    // Hide the acknowledge button
    document.getElementById('acknowledge-container').classList.add('hidden');
    
    // Show confirmation
    const btn = document.getElementById('acknowledge-btn');
    btn.textContent = 'VMA Kvitterat';
    btn.style.backgroundColor = '#28a745';
    
    // Reset after 2 seconds
    setTimeout(() => {
      btn.textContent = 'Kvittera VMA';
      btn.style.backgroundColor = '#ff0000';
    }, 2000);
    
  } catch (error) {
    console.error('Error acknowledging alerts:', error);
  }
}document.addEventListener('DOMContentLoaded', init);

let testMode = false;

// Initialize the popup
async function init() {
  setupEventListeners();
  const settings = await chrome.storage.sync.get(['testMode']);
  testMode = settings.testMode || false;
  updateTestButton();
  await loadAlerts();
}

// Set up event listeners
function setupEventListeners() {
  document.getElementById('refresh-btn').addEventListener('click', refreshAlerts);
  document.getElementById('options-btn').addEventListener('click', openOptions);
  document.getElementById('test-mode-btn').addEventListener('click', toggleTestMode);
  document.getElementById('acknowledge-btn').addEventListener('click', acknowledgeAlerts);
}

// Load alerts from storage
async function loadAlerts() {
  const { activeAlerts } = await chrome.storage.local.get(['activeAlerts']);
  
  // Update last checked time
  document.getElementById('last-checked').textContent = new Date().toLocaleTimeString();
  
  if (!activeAlerts || activeAlerts.length === 0) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('no-alerts').classList.remove('hidden');
    document.getElementById('alerts-list').classList.add('hidden');
    document.getElementById('acknowledge-container').classList.add('hidden');
    document.getElementById('status-text').textContent = 'Normal';
    document.getElementById('status-text').classList.remove('active');
    return;
  }
  
  // We have alerts to display
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('no-alerts').classList.add('hidden');
  document.getElementById('alerts-list').classList.remove('hidden');
  document.getElementById('status-text').textContent = 'Aktiv VMA';
  document.getElementById('status-text').classList.add('active');
  
  // Check if we have severe alerts to show acknowledge button
  const hasSevere = activeAlerts.some(alert => {
    if (!alert.info || alert.info.length === 0) return false;
    return alert.info.some(info => 
      info.severity === 'Extreme' || info.severity === 'Severe'
    );
  });
  
  if (hasSevere) {
    document.getElementById('acknowledge-container').classList.remove('hidden');
  } else {
    document.getElementById('acknowledge-container').classList.add('hidden');
  }
  
  // Clear previous alerts
  const alertsList = document.getElementById('alerts-list');
  alertsList.innerHTML = '';
  
  // Add each alert to the list
  activeAlerts.forEach(alert => {
    const alertElement = createAlertElement(alert);
    alertsList.appendChild(alertElement);
  });
}

// Create DOM element for an alert
function createAlertElement(alert) {
  const template = document.getElementById('alert-template');
  const alertElement = template.content.cloneNode(true);
  
  // Handle status and type
  const alertType = alertElement.querySelector('.alert-type');
  if (alert.status === 'Test') {
    alertType.textContent = 'Test VMA';
    alertType.classList.add('test');
  } else {
    alertType.textContent = 'VMA';
    
    // Set severity class if available
    if (alert.info && alert.info.length > 0) {
      const severity = alert.info[0].severity;
      if (severity === 'Minor') {
        alertType.classList.add('minor');
      } else if (severity === 'Moderate') {
        alertType.classList.add('major');
      } else if (severity === 'Severe' || severity === 'Extreme') {
        alertType.classList.add('severe');
      }
    }
  }
  
  // Set timestamp
  const date = new Date(alert.sent);
  alertElement.querySelector('.alert-time').textContent = date.toLocaleString();
  
  // Set title and description
  if (alert.info && alert.info.length > 0) {
    const info = alert.info[0]; // Use first info object
    alertElement.querySelector('.alert-title').textContent = info.event || 'Viktigt Meddelande till Allmänheten';
    alertElement.querySelector('.alert-description').textContent = info.description || 'Ingen detaljerad information tillgänglig.';
    
    // Set areas
    if (info.area && info.area.length > 0) {
      const areaNames = info.area.map(area => area.areaDesc).join(', ');
      alertElement.querySelector('.alert-location').textContent = areaNames;
    } else {
      alertElement.querySelector('.alert-location').textContent = 'Hela landet';
    }
  } else {
    alertElement.querySelector('.alert-title').textContent = 'Viktigt Meddelande till Allmänheten';
    alertElement.querySelector('.alert-description').textContent = 'Ingen detaljerad information tillgänglig.';
    alertElement.querySelector('.alert-location').textContent = 'Information saknas';
  }
  
  return alertElement.firstElementChild;
}

// Refresh alerts
function refreshAlerts() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('no-alerts').classList.add('hidden');
  document.getElementById('alerts-list').classList.add('hidden');
  
  chrome.runtime.sendMessage({ action: 'checkForAlerts' }, response => {
    if (response && response.success) {
      loadAlerts();
    }
  });
}

// Open options page
function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options/options.html'));
  }
}

// Toggle test mode
function toggleTestMode() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('no-alerts').classList.add('hidden');
  document.getElementById('alerts-list').classList.add('hidden');
  
  console.log('Toggling test mode, current state:', testMode);
  
  chrome.runtime.sendMessage({ action: 'testAlert' }, response => {
    console.log('Test mode toggle response:', response);
    
    if (response && response.success) {
      testMode = !testMode;
      updateTestButton();
      
      // Force reload alerts after a delay
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'checkForAlerts' }, () => {
          setTimeout(loadAlerts, 500);
        });
      }, 1000);
    } else {
      console.error('Failed to toggle test mode');
      // Try to reload anyway
      setTimeout(loadAlerts, 1500);
    }
  });
}

// Update test button based on current mode
function updateTestButton() {
  const button = document.getElementById('test-mode-btn');
  if (testMode) {
    button.textContent = 'Avaktivera test';
    button.style.backgroundColor = '#666';
  } else {
    button.textContent = 'Testa VMA';
    button.style.backgroundColor = '#0077ff';
  }
}