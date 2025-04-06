// Constants
const API_URL = 'https://vmaapi.sr.se/api/v2/alerts';
const TEST_API_URL = 'https://vmaapi.sr.se/testapi/v2/alerts';
const POLL_INTERVAL = 5; // minutes
const BLINK_INTERVAL = 800; // milliseconds
const STARTUP_DELAY = 15000; // milliseconds - wait 15 seconds before first check
const DEBUG = false; // Set to false in production
const OLD_ALERT_THRESHOLD = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const MAX_HISTORY_ITEMS = 3; // Antal VMA som ska sparas i historiken
const VERSION = '1.1'; // Current extension version

// Track blinking state
let blinkingTimer = null;
let browserReady = false;

// Icon paths for different alert states
const ICONS = {
  default: {
    16: 'icons/lamp-green-16.png',
    32: 'icons/lamp-green-32.png',
    48: 'icons/lamp-green-48.png',
    128: 'icons/lamp-green-128.png'
  },
  minor: {
    16: 'icons/lamp-yellow-16.png',
    32: 'icons/lamp-yellow-32.png',
    48: 'icons/lamp-yellow-48.png',
    128: 'icons/lamp-yellow-128.png'
  },
  major: {
    16: 'icons/lamp-orange-16.png',
    32: 'icons/lamp-orange-32.png',
    48: 'icons/lamp-orange-48.png',
    128: 'icons/lamp-orange-128.png'
  },
  severe: {
    16: 'icons/lamp-red-16.png',
    32: 'icons/lamp-red-32.png',
    48: 'icons/lamp-red-48.png',
    128: 'icons/lamp-red-128.png'
  },
  test: {
    16: 'icons/lamp-blue-16.png',
    32: 'icons/lamp-blue-32.png',
    48: 'icons/lamp-blue-48.png',
    128: 'icons/lamp-blue-128.png'
  }
};

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

// Detect browser - mainly to help with debugging
const isEdge = navigator.userAgent.includes("Edg/");
logger.info('Running in ' + (isEdge ? 'Microsoft Edge' : 'Chrome/Other Chromium browser'));

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  logger.important(`VMA Monitor installed/updated to v${VERSION}`);
  
  // Check if this is an update and perform migration if needed
  if (details.reason === 'update') {
    logger.important(`Updated from version ${details.previousVersion} to ${VERSION}`);
    performMigration(details.previousVersion);
  }
  
  // Set default options
  chrome.storage.sync.get(['geoCode', 'testMode', 'preferredLanguage'], (result) => {
    if (!result.geoCode) {
      chrome.storage.sync.set({ geoCode: '00' }); // Default to all Sweden
    }
    if (result.testMode === undefined) {
      chrome.storage.sync.set({ testMode: false });
    }
    if (result.preferredLanguage === undefined) {
      // Detect browser language or default to Swedish
      const browserLang = chrome.i18n.getUILanguage();
      const preferredLanguage = browserLang.startsWith('en') ? 'en' : 'sv';
      chrome.storage.sync.set({ preferredLanguage });
      logger.important(`Setting default language to: ${preferredLanguage} based on browser UI ${browserLang}`);
    }
  });

  // Initiera vmaHistory om den inte finns
  chrome.storage.local.get(['vmaHistory'], (result) => {
    if (!result.vmaHistory) {
      chrome.storage.local.set({ vmaHistory: [] });
    }
  });

  // Set default icon
  chrome.action.setIcon({ path: ICONS.default });

  // Create alarm for polling
  chrome.alarms.create('pollVMA', { periodInMinutes: POLL_INTERVAL });
  
  // Create alarm for cleaning old acknowledged alerts (once per day)
  chrome.alarms.create('cleanOldAlerts', { periodInMinutes: 1440 }); // 1440 minutes = 24 hours
});

// Perform migration when updating from old version
async function performMigration(previousVersion) {
  try {
    // Migration for pre-1.1 (adding language support)
    if (previousVersion && parseFloat(previousVersion) < 1.1) {
      logger.important("Performing migration to v1.1 (adding language support)");
      
      // Add preferredLanguage setting if not already existing
      const { preferredLanguage } = await chrome.storage.sync.get(['preferredLanguage']);
      if (preferredLanguage === undefined) {
        const browserLang = chrome.i18n.getUILanguage();
        const newPreferredLanguage = browserLang.startsWith('en') ? 'en' : 'sv';
        await chrome.storage.sync.set({ preferredLanguage: newPreferredLanguage });
        logger.important(`Migration: Added preferredLanguage setting: ${newPreferredLanguage}`);
      }
    }
  } catch (error) {
    logger.error("Error during migration", error);
  }
}

// Wait for the browser to be ready before doing initial checks
chrome.runtime.onStartup.addListener(() => {
  logger.important(`VMA Monitor v${VERSION} starting up`);
  // Set a delayed initial check to ensure browser windows are available
  setTimeout(() => {
    browserReady = true;
    safeCheckForAlerts();
    
    // Also clean old alerts on startup
    cleanOldAcknowledgedAlerts();
    
    // Rensa historiken från test-VMA
    cleanHistoryFromTestAlerts();
  }, STARTUP_DELAY);
});

// Handle alarm for polling
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollVMA') {
    safeCheckForAlerts();
  } else if (alarm.name === 'cleanOldAlerts') {
    cleanOldAcknowledgedAlerts();
    cleanHistoryFromTestAlerts(); // Rensa historiken från test-VMA regelbundet
  }
});

// Rensa historiken från test-VMA
async function cleanHistoryFromTestAlerts() {
  try {
    const { vmaHistory = [] } = await chrome.storage.local.get(['vmaHistory']);
    
    if (vmaHistory.length === 0) {
      return;
    }
    
    // Filtrera bort alla testlarm från historiken
    const filteredHistory = vmaHistory.filter(alert => {
      // Kontrollera explicit om det är ett testlarm
      if (alert.status === 'Test') {
        return false;
      }
      
      // Kontrollera om identifier innehåller 'TEST' eller 'test'
      if (alert.identifier && (
          alert.identifier.includes('TEST') || 
          alert.identifier.includes('test')
      )) {
        return false;
      }
      
      // Kontrollera om beskrivningen innehåller testinformation
      if (alert.info && alert.info.length > 0) {
        const description = alert.info[0].description || '';
        if (description.includes('TEST') || 
            description.includes('test') || 
            description.includes('Test')) {
          return false;
        }
      }
      
      return true;
    });
    
    // Om några test-VMA togs bort, uppdatera historiken
    if (filteredHistory.length < vmaHistory.length) {
      logger.important(`Cleaned ${vmaHistory.length - filteredHistory.length} test alerts from history`);
      await chrome.storage.local.set({ vmaHistory: filteredHistory });
    }
  } catch (error) {
    logger.error('Error cleaning history from test alerts:', error);
  }
}

// Clean up old acknowledged alerts (older than 3 days)
async function cleanOldAcknowledgedAlerts() {
  try {
    const { acknowledgedAlerts = [] } = await chrome.storage.local.get(['acknowledgedAlerts']);
    
    if (acknowledgedAlerts.length === 0) {
      logger.info('No acknowledged alerts to clean up');
      return;
    }
    
    logger.info(`Checking for old acknowledged alerts to clean up. Current count: ${acknowledgedAlerts.length}`);
    
    const now = Date.now();
    let alertsWithTimestamp = [];
    
    // We store alerts with timestamps if they don't have one already
    acknowledgedAlerts.forEach(alertId => {
      // Check if the alert ID already contains a timestamp
      if (alertId.includes('::')) {
        alertsWithTimestamp.push(alertId);
      } else {
        // If not, add current timestamp
        alertsWithTimestamp.push(`${alertId}::${now}`);
      }
    });
    
    // Filter out old alerts
    const newAcknowledgedAlerts = alertsWithTimestamp.filter(alertWithTimestamp => {
      const [, timestampStr] = alertWithTimestamp.split('::');
      if (!timestampStr) return true; // Keep alerts without timestamps
      
      const timestamp = parseInt(timestampStr);
      const age = now - timestamp;
      return age < OLD_ALERT_THRESHOLD;
    });
    
    // If we removed any alerts, update storage
    if (newAcknowledgedAlerts.length < alertsWithTimestamp.length) {
      logger.important(`Cleaned up ${alertsWithTimestamp.length - newAcknowledgedAlerts.length} old acknowledged alerts`);
      await chrome.storage.local.set({ acknowledgedAlerts: newAcknowledgedAlerts });
    } else {
      logger.info('No old acknowledged alerts to clean up');
    }
  } catch (error) {
    logger.error('Error cleaning old acknowledged alerts:', error);
  }
}

// Funktion för att starta blinkning med utropstecken och VMA
function startTwoBadgeBlink(iconType, isSilent = false) {
  const badgeColor = {
    'test': '#0077ff',
    'minor': '#FFD700',
    'major': '#ff7700',
    'severe': '#ff0000'
  };
  
  chrome.action.setBadgeBackgroundColor({ color: badgeColor[iconType] });
  
  // Avbryt eventuell befintlig blinkning
  if (blinkingTimer) {
    clearInterval(blinkingTimer);
  }
  
  // Om tillägget är i tyst läge (kvitterat), visa ingen badge-text
  if (isSilent) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  
  // För allvarliga VMA, rotera mellan "!" och "VMA"
  if (iconType === 'severe') {
    let blinkState = true;
    
    blinkingTimer = setInterval(() => {
      chrome.action.setBadgeText({ text: blinkState ? '!' : 'VMA' });
      blinkState = !blinkState;
    }, BLINK_INTERVAL);
  } 
  // För andra allvarlighetsnivåer
  else if (iconType !== 'default') {
    let blinkState = true;
    
    blinkingTimer = setInterval(() => {
      chrome.action.setBadgeText({ text: blinkState ? '!' : '' });
      blinkState = !blinkState;
    }, BLINK_INTERVAL);
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Create a detailed notification for a VMA - Edge-optimerad
async function createDetailedNotification(alert) {
  if (!alert || !alert.info || alert.info.length === 0) {
    return;
  }
  
  try {
    // Get preferred language
    const { preferredLanguage = 'sv' } = await chrome.storage.sync.get(['preferredLanguage']);
    
    // Find best matching info based on language preference
    let info = findBestMatchingInfo(alert.info, preferredLanguage);
    
    const title = info.event || chrome.i18n.getMessage('notificationTitle');
    let message = info.description || chrome.i18n.getMessage('noDetailedInfo');
    
    // Trim message if too long (Edge can have different limits)
    if (message.length > 100) {
      message = message.substring(0, 97) + '...';
    }
    
    // Add area information if available
    let areas = '';
    if (info.area && info.area.length > 0) {
      areas = info.area.map(a => a.areaDesc).join(', ');
    }
    
    // Create detailed notification with Edge-specific options
    chrome.notifications.create('vma-alert-details', {
      type: 'basic',
      iconUrl: 'icons/lamp-red-128.png',
      title: title,
      message: message,
      contextMessage: areas ? `${chrome.i18n.getMessage('affectedAreas')}: ${areas}` : '',
      priority: 2,
      requireInteraction: true,  // Notification stays until dismissed
      silent: false  // Make sure sound plays in Edge
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
  }
}

// Find the best matching info object based on language preference
function findBestMatchingInfo(infoArray, preferredLanguage) {
  if (!infoArray || infoArray.length === 0) {
    return {}; // Return empty object if no info available
  }
  
  // For Swedish preference
  if (preferredLanguage === 'sv') {
    // First try to find Swedish info
    const svInfo = infoArray.find(info => info.language === 'sv-SE');
    if (svInfo) return svInfo;
    
    // If no Swedish found, use English if available
    const enInfo = infoArray.find(info => info.language === 'en-US');
    if (enInfo) return enInfo;
  } 
  // For English preference
  else if (preferredLanguage === 'en') {
    // First try to find English info
    const enInfo = infoArray.find(info => info.language === 'en-US');
    if (enInfo) return enInfo;
    
    // If no English found, fall back to Swedish
    const svInfo = infoArray.find(info => info.language === 'sv-SE');
    if (svInfo) return svInfo;
  }
  
  // If no match by language or fallback, just return the first info
  return infoArray[0];
}

// Check if we should auto-open the popup for severe alerts
async function checkIfShouldAutoOpenPopup(alerts) {
  if (!browserReady) {
    logger.info('Browser not ready, skipping popup check');
    return;
  }
  
  try {
    // Get the list of acknowledged alerts
    const { acknowledgedAlerts = [] } = await chrome.storage.local.get(['acknowledgedAlerts']);
    
    // Filter severe alerts
    const severeAlerts = alerts.filter(alert => {
      if (!alert.info || alert.info.length === 0) return false;
      
      return alert.info.some(info => 
        info.severity === 'Extreme' || info.severity === 'Severe'
      );
    });
    
    // Check if any severe alert has not been acknowledged
    const unacknowledgedSevereAlerts = severeAlerts.filter(alert => {
      // Extract just the identifier part if the stored value has a timestamp
      const acknowledgedIds = acknowledgedAlerts.map(item => {
        return item.includes('::') ? item.split('::')[0] : item;
      });
      return !acknowledgedIds.includes(alert.identifier);
    });
    
    if (unacknowledgedSevereAlerts.length === 0) {
      return; // No severe unacknowledged alerts
    }
    
    // Create a detailed notification for the first unacknowledged severe alert
    createDetailedNotification(unacknowledgedSevereAlerts[0]);
    
    // Also create a basic notification encouraging to click the icon
    try {
      const { preferredLanguage = 'sv' } = await chrome.storage.sync.get(['preferredLanguage']);
      
      chrome.notifications.create('vma-alert', {
        type: 'basic',
        iconUrl: 'icons/lamp-red-128.png',
        title: chrome.i18n.getMessage('importantMessage'),
        message: chrome.i18n.getMessage('clickForMoreInfo'),
        priority: 2,
        silent: false
      });
    } catch (error) {
      logger.error('Error creating notification:', error);
    }
  } catch (error) {
    logger.error('Error checking acknowledged alerts:', error);
  }
}

// Safer check for alerts that handles startup conditions
function safeCheckForAlerts() {
  logger.info('Performing safe check for alerts');
  try {
    checkForAlerts().catch(err => {
      logger.error('Error in checkForAlerts:', err);
    });
  } catch (error) {
    logger.error('Error initiating alert check:', error);
  }
}

// Check for VMA alerts
async function checkForAlerts() {
  try {
    const { geoCode, testMode } = await chrome.storage.sync.get(['geoCode', 'testMode']);
    logger.info(`Checking for alerts - Test mode: ${testMode}, Region: ${geoCode}`);
    
    const url = buildApiUrl(geoCode, testMode);
    logger.info(`Using API URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    logger.info(`Received data with ${data.alerts?.length || 0} alerts`);
    
    if (testMode && (!data.alerts || data.alerts.length === 0)) {
      // In test mode, create a fake test alert if none were found
      const testAlert = createTestAlert();
      processAlerts([testAlert], testMode);
    } else {
      processAlerts(data.alerts || [], testMode);
    }
    
    // När vi är i testläge och får nya alerts, rensa historiken från test-VMA
    if (testMode) {
      cleanHistoryFromTestAlerts();
    }
  } catch (error) {
    logger.error('Error checking VMA alerts:', error);
    
    // In test mode, create a fake test alert on error
    const { testMode } = await chrome.storage.sync.get(['testMode']);
    if (testMode) {
      const testAlert = createTestAlert();
      processAlerts([testAlert], testMode);
    }
  }
}

// Create a test alert for demo purposes
function createTestAlert() {
  return {
    identifier: "TEST-VMA-" + Date.now(),
    sender: "VMA Monitor Extension",
    sent: new Date().toISOString(),
    status: "Test",
    msgType: "Alert",
    scope: "Public",
    info: [
      // Swedish info
      {
        language: "sv-SE",
        category: "Safety",
        event: "Test VMA",
        urgency: "Expected",
        severity: "Minor",
        certainty: "Likely",
        senderName: "VMA Monitor Extension",
        description: "Detta är ett test av VMA Monitor. Vid ett riktigt VMA skulle viktig information visas här.",
        area: [{
          areaDesc: "Test Region"
        }]
      },
      // English info (added in v1.1)
      {
        language: "en-US",
        category: "Safety",
        event: "Test Emergency Alert",
        urgency: "Expected",
        severity: "Minor",
        certainty: "Likely",
        senderName: "VMA Monitor Extension",
        description: "This is a test of the VMA Monitor. In case of a real emergency, important information would be displayed here.",
        area: [{
          areaDesc: "Test Region"
        }]
      }
    ]
  };
}

// Build API URL based on settings
function buildApiUrl(geoCode, testMode) {
  // Always use test API or examples endpoint in test mode
  const baseUrl = testMode ? TEST_API_URL : API_URL;
  
  // When in test mode, try to use the examples endpoint
  if (testMode) {
    return `https://vmaapi.sr.se/testapi/v2/examples/data`;
  }
  
  if (geoCode && geoCode !== '00') {
    return `${baseUrl}/${geoCode}`;
  }
  
  return baseUrl;
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

// Uppdatera VMA-historik
async function updateVmaHistory(expiredAlerts) {
  try {
    // Om inga utgångna larm, gör ingenting
    if (expiredAlerts.length === 0) {
      return;
    }
    
    const { vmaHistory = [] } = await chrome.storage.local.get(['vmaHistory']);
    
    // Filtrera bort alla testlarm
    const nonTestAlerts = expiredAlerts.filter(alert => {
      if (isTestAlert(alert)) {
        logger.info(`Filtering out test alert from history: ${alert.identifier}`);
        return false;
      }
      return true;
    });
    
    // Om inga riktiga larm finns, gör ingenting
    if (nonTestAlerts.length === 0) {
      logger.info('No non-test alerts to add to history');
      return;
    }
    
    // Lägg till utgångsdatum/tid till VMA
    const timeStampedAlerts = nonTestAlerts.map(alert => ({
      ...alert,
      expiredAt: new Date().toISOString()
    }));
    
    // Filtrera även bort eventuella test-VMA från befintlig historik
    const filteredHistory = vmaHistory.filter(alert => !isTestAlert(alert));
    
    // Kombinera med befintlig historik och begränsa till MAX_HISTORY_ITEMS poster
    const newHistory = [...timeStampedAlerts, ...filteredHistory]
      .sort((a, b) => new Date(b.expiredAt || b.sent) - new Date(a.expiredAt || a.sent))
      .slice(0, MAX_HISTORY_ITEMS);
    
    await chrome.storage.local.set({ vmaHistory: newHistory });
    logger.important(`VMA history updated, now contains ${newHistory.length} items`);
  } catch (error) {
    logger.error('Error updating VMA history:', error);
  }
}

// Process alerts from API response
async function processAlerts(alerts, isTestMode) {
  // Hämta tidigare aktiva VMA
  const { activeAlerts: previousActiveAlerts = [] } = await chrome.storage.local.get(['activeAlerts']);

  // Filter valid alerts (Actual status and Alert msgType)
  const activeAlerts = alerts.filter(alert => 
    (alert.status === 'Actual' || alert.status === 'Test') && 
    alert.msgType === 'Alert'
  );

  // Om vi är i testläge, lagrings inga tidigare alerts för att jämföra 
  // (detta förhindrar att test-VMA läggs till i historiken när testläge avslutas)
  if (!isTestMode) {
    // Identifiera VMA som inte längre är aktiva, men bara icke-test VMA
    const expiredAlerts = previousActiveAlerts.filter(prevAlert => 
      !activeAlerts.some(newAlert => newAlert.identifier === prevAlert.identifier) && 
      !isTestAlert(prevAlert)
    );
    
    // Om vi har utgångna VMA, lägg till dem i historiken
    if (expiredAlerts.length > 0) {
      logger.info(`Found ${expiredAlerts.length} expired VMA alerts to check for history`);
      updateVmaHistory(expiredAlerts);
    }
  }

  if (activeAlerts.length === 0) {
    // No active alerts, set default icon
    chrome.action.setIcon({ path: ICONS.default });
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.set({ activeAlerts: [] });
    
    // Stop blinking if it was active
    if (blinkingTimer) {
      clearInterval(blinkingTimer);
      blinkingTimer = null;
    }
    
    return;
  }

  // Store alerts for popup
  chrome.storage.local.set({ activeAlerts });

  // Determine highest severity for icon
  const iconType = determineIconType(activeAlerts);
  chrome.action.setIcon({ path: ICONS[iconType] });
  
  // Kontrollera om VMA är i tyst läge (kvitterat)
  const { silentMode = false } = await chrome.storage.local.get(['silentMode']);
  
  // Start badge blinking with exclamation and VMA, or silent if acknowledged
  startTwoBadgeBlink(iconType, silentMode);
}

// Determine highest severity for icon
function determineIconType(alerts) {
  // Check if there are any test alerts
  const isTest = alerts.some(alert => alert.status === 'Test');
  if (isTest) {
    return 'test';
  }

  // Look at all alerts' severity to determine the highest
  let highestSeverity = 'default';
  let hasSevere = false;
  
  for (const alert of alerts) {
    if (!alert.info || alert.info.length === 0) continue;
    
    for (const info of alert.info) {
      if (info.severity === 'Extreme') {
        hasSevere = true;
        return 'severe'; // Highest priority, return immediately
      } else if (info.severity === 'Severe' && highestSeverity !== 'severe') {
        highestSeverity = 'severe';
        hasSevere = true;
      } else if (info.severity === 'Moderate' && highestSeverity !== 'severe') {
        highestSeverity = 'major';
      } else if (info.severity === 'Minor' && highestSeverity !== 'severe' && highestSeverity !== 'major') {
        highestSeverity = 'minor';
      }
    }
  }
  
  // Check if we need to auto-open the popup for severe alerts
  if (hasSevere) {
    checkIfShouldAutoOpenPopup(alerts);
  }
  
  return highestSeverity;
}

// Manual check can be triggered from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkForAlerts') {
    safeCheckForAlerts();
    sendResponse({ success: true });
    return true; // Indicates async response
  } else if (message.action === 'testAlert') {
    testAlertMode();
    sendResponse({ success: true });
    return true; // Indicates async response
  } else if (message.action === 'silenceAlerts') {
    // Ta emot meddelande från popup för att tysta varningarna (kvittering)
    enableSilentMode();
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'clearHistory') {
    // Nytt: Möjlighet att rensa historiken
    chrome.storage.local.set({ vmaHistory: [] }, function() {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.action === 'getVersion') {
    // Return the current version
    sendResponse({ version: VERSION });
    return false; // No async response needed
  }
});

// Aktivera tyst läge för aktuella VMA (efter kvittering)
async function enableSilentMode() {
  try {
    // Hämta aktuell ikon-typ
    const { activeAlerts = [] } = await chrome.storage.local.get(['activeAlerts']);
    
    // Sätt tyst läge i storage
    await chrome.storage.local.set({ silentMode: true });
    
    // Uppdatera badge till tyst läge
    if (activeAlerts.length > 0) {
      const iconType = determineIconType(activeAlerts);
      startTwoBadgeBlink(iconType, true); // True = tyst läge
    }
  } catch (error) {
    logger.error('Error enabling silent mode:', error);
  }
}

// Set test mode for alert visualization
function testAlertMode() {
  chrome.storage.sync.get('testMode', (result) => {
    const testMode = !result.testMode;
    logger.info(`Toggling test mode: ${testMode}`);
    
    // Force blue icon when entering test mode
    if (testMode) {
      chrome.action.setIcon({ path: ICONS.test });
      
      // När testläge aktiveras, rensa historiken från test-VMA
      cleanHistoryFromTestAlerts();
    }
    
    chrome.storage.sync.set({ testMode }, () => {
      // Ensure storage is set before checking alerts
      setTimeout(() => {
        safeCheckForAlerts();
      }, 500);
    });
  });
}

// Handle notification clicks - Edge-anpassad
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'vma-alert' || notificationId === 'vma-alert-details') {
    // När notifikationen klickas, öppna tilläggets popup
    // I Edge kan vi behöva göra detta på ett säkrare sätt
    try {
      chrome.action.openPopup();
    } catch (error) {
      logger.error('Error opening popup:', error);
      // Fallback: Visa ett nytt meddelande som guide
      chrome.notifications.create('vma-popup-guide', {
        type: 'basic',
        iconUrl: 'icons/lamp-red-128.png',
        title: chrome.i18n.getMessage('clickVmaIcon'),
        message: chrome.i18n.getMessage('clickIconDetails'),
        priority: 2
      });
    }
    chrome.notifications.clear(notificationId);
  }
});

// Set a startup delay to ensure browser is fully initialized
setTimeout(() => {
  browserReady = true;
  logger.important('Browser ready state set to true');
  safeCheckForAlerts(); // Initial check with delay
  
  // Rensa historiken från test-VMA vid start
  cleanHistoryFromTestAlerts();
}, STARTUP_DELAY);