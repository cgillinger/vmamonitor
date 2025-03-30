// Check if we should auto-open the popup for severe alerts
async function checkIfShouldAutoOpenPopup(alerts) {
  try {
    // Get the list of acknowledged alerts
    const { acknowledgedAlerts = [] } = await chrome.storage.local.get(['acknowledgedAlerts']);
    
    // Check if all severe alerts have been acknowledged
    const severeAlerts = alerts.filter(alert => {
      if (!alert.info || alert.info.length === 0) return false;
      
      return alert.info.some(info => 
        info.severity === 'Extreme' || info.severity === 'Severe'
      );
    });
    
    // Check if any severe alert has not been acknowledged
    const hasUnacknowledgedAlert = severeAlerts.some(alert => 
      !acknowledgedAlerts.includes(alert.identifier)
    );
    
    if (hasUnacknowledgedAlert) {
      // Open the popup if there are unacknowledged severe alerts
      chrome.action.openPopup();
    }
  } catch (error) {
    console.error('Error checking acknowledged alerts:', error);
  }
}// Constants
const API_URL = 'https://vmaapi.sr.se/api/v2/alerts';
const TEST_API_URL = 'https://vmaapi.sr.se/testapi/v2/alerts';
const POLL_INTERVAL = 5; // minutes
const BLINK_INTERVAL = 1000; // milliseconds

// Track blinking state
let blinkingTimer = null;
let blinkState = true;

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

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  // Set default options
  chrome.storage.sync.get(['geoCode', 'testMode'], (result) => {
    if (!result.geoCode) {
      chrome.storage.sync.set({ geoCode: '00' }); // Default to all Sweden
    }
    if (result.testMode === undefined) {
      chrome.storage.sync.set({ testMode: false });
    }
  });

  // Set default icon
  chrome.action.setIcon({ path: ICONS.default });

  // Create alarm for polling
  chrome.alarms.create('pollVMA', { periodInMinutes: POLL_INTERVAL });
});

// Handle alarm for polling
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollVMA') {
    checkForAlerts();
  }
});

// Check for VMA alerts
async function checkForAlerts() {
  try {
    const { geoCode, testMode } = await chrome.storage.sync.get(['geoCode', 'testMode']);
    console.log('Checking for alerts - Test mode:', testMode, 'Region:', geoCode);
    
    const url = buildApiUrl(geoCode, testMode);
    console.log('Using API URL:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Received data:', data);
    
    if (testMode && (!data.alerts || data.alerts.length === 0)) {
      // In test mode, create a fake test alert if none were found
      const testAlert = createTestAlert();
      processAlerts([testAlert]);
    } else {
      processAlerts(data.alerts || []);
    }
  } catch (error) {
    console.error('Error checking VMA alerts:', error);
    
    // In test mode, create a fake test alert on error
    const { testMode } = await chrome.storage.sync.get(['testMode']);
    if (testMode) {
      const testAlert = createTestAlert();
      processAlerts([testAlert]);
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
    info: [{
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
    }]
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

// Process alerts from API response
function processAlerts(alerts) {
  // Filter valid alerts (Actual status and Alert msgType)
  const activeAlerts = alerts.filter(alert => 
    (alert.status === 'Actual' || alert.status === 'Test') && 
    alert.msgType === 'Alert'
  );

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
  
  // Set badge with matching color
  if (iconType !== 'default') {
    const badgeColor = {
      'test': '#0077ff',
      'minor': '#FFD700',
      'major': '#ff7700',
      'severe': '#ff0000'
    };
    chrome.action.setBadgeBackgroundColor({ color: badgeColor[iconType] });
    chrome.action.setBadgeText({ text: '!' });
    
    // Start blinking if not already blinking
    if (!blinkingTimer) {
      blinkState = true;
      blinkingTimer = setInterval(() => {
        blinkState = !blinkState;
        if (blinkState) {
          chrome.action.setBadgeText({ text: '!' });
        } else {
          chrome.action.setBadgeText({ text: '' });
        }
      }, BLINK_INTERVAL);
    }
  } else {
    chrome.action.setBadgeText({ text: '' });
    
    // Stop blinking if it was active
    if (blinkingTimer) {
      clearInterval(blinkingTimer);
      blinkingTimer = null;
    }
  }
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
    checkForAlerts().then(() => sendResponse({ success: true }));
    return true; // Indicates async response
  } else if (message.action === 'testAlert') {
    testAlertMode();
    sendResponse({ success: true });
    return true; // Indicates async response
  }
});

// Set test mode for alert visualization
function testAlertMode() {
  chrome.storage.sync.get('testMode', (result) => {
    const testMode = !result.testMode;
    console.log('Toggling test mode:', testMode);
    
    // Force blue icon when entering test mode
    if (testMode) {
      chrome.action.setIcon({ path: ICONS.test });
    }
    
    chrome.storage.sync.set({ testMode }, () => {
      // Ensure storage is set before checking alerts
      setTimeout(() => {
        checkForAlerts();
      }, 500);
    });
  });
}

// Initial check on startup
checkForAlerts();