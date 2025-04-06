document.addEventListener('DOMContentLoaded', init);

let testMode = false;
let currentLanguage = 'sv'; // Default to Swedish
const DEBUG = false; // Set to false in production
const VERSION = '1.1'; // Current extension version

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
    // Set version number
    document.getElementById('version-text').textContent = `v${VERSION}`;
    
    // Load language preference
    const settings = await chrome.storage.sync.get(['testMode', 'preferredLanguage']);
    testMode = settings.testMode || false;
    currentLanguage = settings.preferredLanguage || 'sv';
    
    // Setup event listeners first so language toggle works immediately
    setupEventListeners();
    
    // Lokalisera UI based on current language
    await updateUIForLanguage(currentLanguage);
    
    // Update test button text
    updateTestButton();
    
    // Load alerts with current language
    await loadAlerts();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}

// Apply language to the interface
async function updateUIForLanguage(language) {
  try {
    // Set the current UI language
    chrome.i18n.getUILanguage = function() { return language === 'sv' ? 'sv' : 'en'; };
    
    // Update language button indicator
    const langBtn = document.getElementById('language-btn');
    langBtn.setAttribute('data-lang', language);
    langBtn.title = language === 'sv' ? 'Byt till engelska' : 'Switch to Swedish';
    
    // Update tab texts
    document.getElementById('active-tab').textContent = language === 'sv' ? 'Aktiva VMA' : 'Active Alerts';
    document.getElementById('history-tab').textContent = language === 'sv' ? 'Historik' : 'History';
    
    // Update loading and no alerts texts
    document.querySelector('#loading p').textContent = language === 'sv' ? 'Hämtar VMA information...' : 'Loading VMA information...';
    
    const noAlertsEls = document.querySelectorAll('#no-alerts p');
    if (noAlertsEls.length > 0) {
      noAlertsEls[0].textContent = language === 'sv' ? 'Inga aktiva VMA för tillfället.' : 'No active VMA alerts at the moment.';
      
      // Last checked text
      const lastCheckedText = language === 'sv' ? 'Senast kontrollerad: ' : 'Last checked: ';
      const lastCheckedSpan = document.getElementById('last-checked');
      const lastCheckedTime = lastCheckedSpan.textContent;
      
      noAlertsEls[1].innerHTML = lastCheckedText;
      noAlertsEls[1].appendChild(lastCheckedSpan);
      lastCheckedSpan.textContent = lastCheckedTime;
    }
    
    // Update acknowledge button
    const acknowledgeBtn = document.getElementById('acknowledge-btn');
    if (acknowledgeBtn) {
      acknowledgeBtn.textContent = language === 'sv' ? 'Kvittera VMA' : 'Acknowledge Alert';
    }
    
    const acknowledgeInfo = document.querySelector('.acknowledge-info');
    if (acknowledgeInfo) {
      acknowledgeInfo.textContent = language === 'sv' 
        ? 'Kvittera för att stoppa blinkande notifiering men behålla röd varningsikon'
        : 'Acknowledge to stop blinking notification but keep the red warning icon';
    }
    
    // Update history container text
    const noHistoryEls = document.querySelectorAll('#no-history p');
    if (noHistoryEls.length > 0) {
      noHistoryEls[0].textContent = language === 'sv' ? 'Ingen VMA-historik tillgänglig.' : 'No VMA history available.';
      noHistoryEls[1].textContent = language === 'sv' 
        ? 'De senaste tre avslutade VMA kommer att visas här.'
        : 'The last three completed VMA alerts will be shown here.';
    }
    
    // Update status text
    const statusText = language === 'sv' ? 'Status: ' : 'Status: ';
    const statusTextEl = document.getElementById('status-text');
    const currentStatus = statusTextEl.textContent;
    const isActive = statusTextEl.classList.contains('active');
    
    const statusContainer = document.querySelector('.status');
    statusContainer.innerHTML = statusText;
    statusContainer.appendChild(statusTextEl);
    
    statusTextEl.textContent = currentStatus === 'Normal' || currentStatus === 'Aktiv VMA' 
      ? (isActive 
          ? (language === 'sv' ? 'Aktiv VMA' : 'Active VMA') 
          : 'Normal')
      : currentStatus;
    
    const versionEl = document.createElement('span');
    versionEl.id = 'version-text';
    versionEl.className = 'version-info';
    versionEl.textContent = `v${VERSION}`;
    statusContainer.appendChild(versionEl);
    
    // Update test button text
    updateTestButton();
    
    // Reload active VMA alerts with correct language
    if (!document.getElementById('alerts-container').classList.contains('hidden')) {
      await loadAlerts();
    } else {
      await loadVmaHistory();
    }
  } catch (error) {
    logger.error('Error updating UI for language', error);
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
  document.getElementById('language-btn').addEventListener('click', toggleLanguage);
}

// Toggle language between Swedish and English
async function toggleLanguage() {
  try {
    // Toggle language
    currentLanguage = currentLanguage === 'sv' ? 'en' : 'sv';
    
    // Save to storage
    await chrome.storage.sync.set({ preferredLanguage: currentLanguage });
    
    // Update UI based on new language
    await updateUIForLanguage(currentLanguage);
    
    // Refresh alerts to use new language
    refreshAlerts();
  } catch (error) {
    logger.error('Error toggling language', error);
  }
}

// Visa fliken med aktiva VMA
function showActiveTab() {
  document.getElementById('active-tab').classList.add('active');
  document.getElementById('history-tab').classList.remove('active');
  document.getElementById('alerts-container').classList.remove('hidden');
  document.getElementById('history-container').classList.add('hidden');
  loadAlerts();
}

// Visa fliken med VMA-historik
function showHistoryTab() {
  document.getElementById('active-tab').classList.remove('active');
  document.getElementById('history-tab').classList.add('active');
  document.getElementById('alerts-container').classList.add('hidden');
  document.getElementById('history-container').classList.remove('hidden');
  loadVmaHistory();
}

// Find the best matching info object based on language preference
function findBestMatchingInfo(infoArray, preferredLanguage) {
  if (!infoArray || infoArray.length === 0) {
    return { info: {}, langCode: 'sv' }; // Return empty object if no info available
  }
  
  // For Swedish preference
  if (preferredLanguage === 'sv') {
    // First try to find Swedish info
    const svInfo = infoArray.find(info => info.language === 'sv-SE');
    if (svInfo) return { info: svInfo, langCode: 'sv' };
    
    // If no Swedish found, use English if available
    const enInfo = infoArray.find(info => info.language === 'en-US');
    if (enInfo) return { info: enInfo, langCode: 'en' };
  } 
  // For English preference
  else if (preferredLanguage === 'en') {
    // First try to find English info
    const enInfo = infoArray.find(info => info.language === 'en-US');
    if (enInfo) return { info: enInfo, langCode: 'en' };
    
    // If no English found, fall back to Swedish
    const svInfo = infoArray.find(info => info.language === 'sv-SE');
    if (svInfo) return { info: svInfo, langCode: 'sv' };
  }
  
  // If no match by language or fallback, just return the first info
  const firstInfo = infoArray[0];
  const langCode = firstInfo.language === 'en-US' ? 'en' : 'sv';
  return { info: firstInfo, langCode };
}

// Load alerts from storage
async function loadAlerts() {
  try {
    const { activeAlerts } = await chrome.storage.local.get(['activeAlerts']);
    const { preferredLanguage = 'sv' } = await chrome.storage.sync.get(['preferredLanguage']);
    
    // Update UI language if necessary
    if (currentLanguage !== preferredLanguage) {
      currentLanguage = preferredLanguage;
      await updateUIForLanguage(currentLanguage);
    }
    
    // Update last checked time
    document.getElementById('last-checked').textContent = new Date().toLocaleTimeString();
    
    if (!activeAlerts || activeAlerts.length === 0) {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('no-alerts').classList.remove('hidden');
      document.getElementById('alerts-list').classList.add('hidden');
      document.getElementById('acknowledge-container').classList.add('hidden');
      document.getElementById('status-text').textContent = currentLanguage === 'sv' ? 'Normal' : 'Normal';
      document.getElementById('status-text').classList.remove('active');
      return;
    }
    
    // We have alerts to display
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('no-alerts').classList.add('hidden');
    document.getElementById('alerts-list').classList.remove('hidden');
    document.getElementById('status-text').textContent = currentLanguage === 'sv' ? 'Aktiv VMA' : 'Active VMA';
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
      const alertElement = createAlertElement(alert, false, preferredLanguage);
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
    // Check all info objects
    return alert.info.some(info => {
      const description = info.description || '';
      const event = info.event || '';
      
      return description.includes('TEST') || 
             description.includes('test') || 
             description.includes('Test') ||
             event.includes('TEST') || 
             event.includes('test') || 
             event.includes('Test');
    });
  }
  
  return false;
}

// Ladda VMA-historik
async function loadVmaHistory() {
  console.log('Loading VMA history');
  
  try {
    const { vmaHistory = [] } = await chrome.storage.local.get(['vmaHistory']);
    const { preferredLanguage = 'sv' } = await chrome.storage.sync.get(['preferredLanguage']);
    
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
      const alertElement = createAlertElement(alert, true, preferredLanguage);
      historyList.appendChild(alertElement);
    });
  } catch (error) {
    console.error('Error loading VMA history:', error);
    document.getElementById('history-list').classList.add('hidden');
    document.getElementById('no-history').classList.remove('hidden');
  }
}

// Create DOM element for an alert
function createAlertElement(alert, isHistory = false, preferredLanguage = 'sv') {
  try {
    const template = document.getElementById('alert-template');
    const alertElement = template.content.cloneNode(true);
    
    // Handle status and type
    const alertType = alertElement.querySelector('.alert-type');
    if (alert.status === 'Test') {
      alertType.textContent = currentLanguage === 'sv' ? 'Test VMA' : 'Test Alert';
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
      expiredEl.textContent = (currentLanguage === 'sv' ? 'Avslutades: ' : 'Ended: ') + expiredDate.toLocaleString();
      alertHeader.appendChild(expiredEl);
    }
    
    // Set title, description, and areas based on language preference
    if (alert.info && alert.info.length > 0) {
      // Find best matching info based on language preference
      const { info, langCode } = findBestMatchingInfo(alert.info, preferredLanguage);
      
      // Add language indicator if we have multiple language versions
      if (alert.info.length > 1) {
        const langIndicator = document.createElement('span');
        langIndicator.classList.add('alert-language', langCode);
        langIndicator.textContent = langCode.toUpperCase();
        alertType.appendChild(langIndicator);
      }
      
      // Set content from selected info
      alertElement.querySelector('.alert-title').textContent = info.event || 
        (currentLanguage === 'sv' ? 'Viktigt Meddelande till Allmänheten' : 'Important Public Announcement');
      
      alertElement.querySelector('.alert-description').textContent = info.description || 
        (currentLanguage === 'sv' ? 'Ingen detaljerad information tillgänglig.' : 'No detailed information available.');
      
      // Set areas
      if (info.area && info.area.length > 0) {
        const areaNames = info.area.map(area => area.areaDesc).join(', ');
        
        // Update the "Affected areas" label
        const areaEl = alertElement.querySelector('.alert-areas p strong');
        areaEl.textContent = (currentLanguage === 'sv' ? 'Berörda områden: ' : 'Affected areas: ');
        
        alertElement.querySelector('.alert-location').textContent = areaNames;
      } else {
        // Update the "Affected areas" label
        const areaEl = alertElement.querySelector('.alert-areas p strong');
        areaEl.textContent = (currentLanguage === 'sv' ? 'Berörda områden: ' : 'Affected areas: ');
        
        alertElement.querySelector('.alert-location').textContent = 
          currentLanguage === 'sv' ? 'Hela landet' : 'Whole country';
      }
    } else {
      alertElement.querySelector('.alert-title').textContent = 
        currentLanguage === 'sv' ? 'Viktigt Meddelande till Allmänheten' : 'Important Public Announcement';
      alertElement.querySelector('.alert-description').textContent = 
        currentLanguage === 'sv' ? 'Ingen detaljerad information tillgänglig.' : 'No detailed information available.';
      
      // Update the "Affected areas" label
      const areaEl = alertElement.querySelector('.alert-areas p strong');
      areaEl.textContent = (currentLanguage === 'sv' ? 'Berörda områden: ' : 'Affected areas: ');
      
      alertElement.querySelector('.alert-location').textContent = 
        currentLanguage === 'sv' ? 'Information saknas' : 'Information missing';
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
    button.textContent = currentLanguage === 'sv' ? 'Avaktivera test' : 'Deactivate Test';
    button.style.backgroundColor = '#666';
  } else {
    button.textContent = currentLanguage === 'sv' ? 'Testa VMA' : 'Test VMA';
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
    btn.textContent = currentLanguage === 'sv' ? 'VMA Kvitterat' : 'Alert Acknowledged';
    btn.style.backgroundColor = '#28a745';
    
    // Reset after 2 seconds
    setTimeout(function() {
      btn.textContent = currentLanguage === 'sv' ? 'Kvittera VMA' : 'Acknowledge Alert';
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