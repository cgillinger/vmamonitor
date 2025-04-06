document.addEventListener('DOMContentLoaded', init);

let testMode = false;
const DEBUG = false; // Set to false in production

// Logger utility for production-appropriate logging
const logger = {
  info: function(message) {
    if (DEBUG) {
      console.log('[VMA-INFO] ' + message);
    }
  },
  warn: function(message) {
    console.warn('[VMA-WARN] ' + message);
  },
  error: function(message, error) {
    console.error('[VMA-ERROR] ' + message, error);
  },
  important: function(message) {
    console.log('[VMA-IMPORTANT] ' + message);
  }
};

// Initialize the popup
async function init() {
  try {
    setupEventListeners();
    const settings = await chrome.storage.sync.get(['testMode']);
    testMode = settings.testMode || false;
    updateTestButton();
    await loadAlerts();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}

// Set up event listeners
function setupEventListeners() {
  document.getElementById('refresh-btn').addEventListener('click', refreshAlerts);
  document.getElementById('options-btn').addEventListener('click', openOptions);
  document.getElementById('test-mode-btn').addEventListener('click', toggleTestMode);
  document.getElementById('acknowledge-btn').addEventListener('click', acknowledgeAlerts);
  document.getElementById('active-tab').addEventListener('click', showActiveTab);
  document.getElementById('history-tab').addEventListener('click', showHistoryTab);
}

// Visa fliken med aktiva VMA
function showActiveTab() {
  document.getElementById('active-tab').classList.add('active');
  document.getElementById('history-tab').classList.remove('active');
  document.getElementById('alerts-container').classList.remove('hidden');
  document.getElementById('history-container').classList.add('hidden');
}

// Visa fliken med VMA-historik
function showHistoryTab() {
  document.getElementById('active-tab').classList.remove('active');
  document.getElementById('history-tab').classList.add('active');
  document.getElementById('alerts-container').classList.add('hidden');
  document.getElementById('history-container').classList.remove('hidden');
  loadVmaHistory();
}

// Load alerts from storage
async function loadAlerts() {
  try {
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
  } catch (error) {
    console.error('Error loading alerts:', error);
  }
}

// Avgör om ett VMA är ett test-VMA baserat på flera kriterier
function isTestAlert(alert) {
  // Kontrollera status
  if (alert.status === 'Test') {
    return true;
  }
  
  // Kontrollera identifier
  if (alert.identifier && (
      alert.identifier.includes('TEST') || 
      alert.identifier.includes('test')
  )) {
    return true;
  }
  
  // Kontrollera beskrivning
  if (alert.info && alert.info.length > 0) {
    const description = alert.info[0].description || '';
    if (description.includes('TEST') || 
        description.includes('test') || 
        description.includes('Test')) {
      return true;
    }
    
    // Kontrollera eventtitel
    const event = alert.info[0].event || '';
    if (event.includes('TEST') || 
        event.includes('test') || 
        event.includes('Test')) {
      return true;
    }
  }
  
  return false;
}

// Ladda VMA-historik
async function loadVmaHistory() {
  console.log('Loading VMA history');
  
  try {
    const { vmaHistory = [] } = await chrome.storage.local.get(['vmaHistory']);
    
    // Filtrera bort test-VMA från vyn även om de av någon anledning hamnat i lagringen
    const filteredHistory = vmaHistory.filter(alert => !isTestAlert(alert));
    
    if (filteredHistory.length === 0) {
      document.getElementById('history-list').classList.add('hidden');
      document.getElementById('no-history').classList.remove('hidden');
      return;
    }
    
    document.getElementById('history-list').classList.remove('hidden');
    document.getElementById('no-history').classList.add('hidden');
    
    // Rensa tidigare historik
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    // Lägg till varje historik-VMA
    filteredHistory.forEach(alert => {
      const alertElement = createAlertElement(alert, true); // true indikerar historik-läge
      historyList.appendChild(alertElement);
    });
  } catch (error) {
    console.error('Error loading VMA history:', error);
    document.getElementById('history-list').classList.add('hidden');
    document.getElementById('no-history').classList.remove('hidden');
  }
}

// Create DOM element for an alert
function createAlertElement(alert, isHistory = false) {
  try {
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
    
    // Om det är ett historik-objekt, lägg till utgångsdatum
    if (isHistory && alert.expiredAt) {
      const expiredDate = new Date(alert.expiredAt);
      const alertHeader = alertElement.querySelector('.alert-header');
      const expiredEl = document.createElement('span');
      expiredEl.classList.add('alert-expired');
      expiredEl.textContent = 'Avslutades: ' + expiredDate.toLocaleString();
      alertHeader.appendChild(expiredEl);
    }
    
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
  } catch (error) {
    console.error('Error creating alert element:', error);
    return document.createElement('div'); // Fallback
  }
}

// Refresh alerts
function refreshAlerts() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('no-alerts').classList.add('hidden');
  document.getElementById('alerts-list').classList.add('hidden');
  
  chrome.runtime.sendMessage({ action: 'checkForAlerts' }, function(response) {
    if (response && response.success) {
      loadAlerts();
      
      // Om vi är på historikfliken, uppdatera historiken också
      if (!document.getElementById('history-container').classList.contains('hidden')) {
        loadVmaHistory();
      }
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
  
  console.log('Toggling test mode, current state: ' + testMode);
  
  chrome.runtime.sendMessage({ action: 'testAlert' }, function(response) {
    console.log('Test mode toggle response received');
    
    if (response && response.success) {
      testMode = !testMode;
      updateTestButton();
      
      // Force reload alerts after a delay
      setTimeout(function() {
        chrome.runtime.sendMessage({ action: 'checkForAlerts' }, function() {
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

// Acknowledge alerts to prevent auto-popup
async function acknowledgeAlerts() {
  try {
    // Get current active and acknowledged alerts
    const storage = await chrome.storage.local.get(['activeAlerts', 'acknowledgedAlerts']);
    const activeAlerts = storage.activeAlerts || [];
    const acknowledgedAlerts = storage.acknowledgedAlerts || [];
    
    // Add current severe alert IDs to acknowledged list with timestamps
    const now = Date.now();
    const severeAlertIds = [];
    
    // Find severe alerts
    for (let i = 0; i < activeAlerts.length; i++) {
      const alert = activeAlerts[i];
      if (!alert.info || alert.info.length === 0) continue;
      
      for (let j = 0; j < alert.info.length; j++) {
        const info = alert.info[j];
        if (info.severity === 'Extreme' || info.severity === 'Severe') {
          severeAlertIds.push(alert.identifier + '::' + now);
          break;
        }
      }
    }
    
    // Create new list with unique IDs
    const existingIds = [];
    for (let i = 0; i < acknowledgedAlerts.length; i++) {
      const item = acknowledgedAlerts[i];
      if (item.includes('::')) {
        existingIds.push(item.split('::')[0]);
      } else {
        existingIds.push(item);
      }
    }
    
    const newAcknowledgedAlerts = acknowledgedAlerts.slice();
    
    // Add only alerts that aren't already acknowledged
    for (let i = 0; i < severeAlertIds.length; i++) {
      const newAlert = severeAlertIds[i];
      const alertId = newAlert.split('::')[0];
      if (!existingIds.includes(alertId)) {
        newAcknowledgedAlerts.push(newAlert);
      }
    }
    
    // Save to storage
    await chrome.storage.local.set({ acknowledgedAlerts: newAcknowledgedAlerts });
    
    // Aktivera tyst läge (stänger av badge-text men behåller röd ikon)
    chrome.runtime.sendMessage({ action: 'silenceAlerts' });
    
    // Hide the acknowledge button
    document.getElementById('acknowledge-container').classList.add('hidden');
    
    // Show confirmation
    const btn = document.getElementById('acknowledge-btn');
    btn.textContent = 'VMA Kvitterat';
    btn.style.backgroundColor = '#28a745';
    
    // Reset after 2 seconds
    setTimeout(function() {
      btn.textContent = 'Kvittera VMA';
      btn.style.backgroundColor = '#ff0000';
    }, 2000);
    
    // Close the popup window if it was created by the background script
    if (window.opener === null && window.history.length <= 1) {
      // This appears to be a standalone popup window
      setTimeout(function() {
        window.close();
      }, 2000);
    }
  } catch (error) {
    console.error('Error acknowledging alerts:', error);
  }
}