import {
  isTestAlert,
  findBestMatchingInfo,
  isSevereAlert,
  isAcknowledged,
  determineIconType,
  compareVersions,
  getExtensionVersion
} from './shared/vma-utils.js';

// Constants
const API_URL = 'https://vmaapi.sr.se/api/v2/alerts';
const TEST_API_URL = 'https://vmaapi.sr.se/testapi/v2/examples/data';
const POLL_INTERVAL = 5; // minutes
const BLINK_INTERVAL = 800; // milliseconds
const STARTUP_DELAY = 15000; // milliseconds - wait before first check after browser start
const DEBUG = false; // Set to false in production
const OLD_ALERT_THRESHOLD = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const MAX_HISTORY_ITEMS = 3; // Antal VMA som ska sparas i historiken
const VERSION = getExtensionVersion(); // Single source of truth: manifest.json

// Page banner (opt-in): dynamically registered content script
const BANNER_SCRIPT_ID = 'vma-page-banner';
const BANNER_ORIGINS = ['http://*/*', 'https://*/*'];
const BANNER_SCRIPT_FILE = 'content/banner.js';

// Track blinking state. NOTE: a MV3 service worker may be suspended at any
// time, which kills this timer. The badge is therefore always set to a
// deterministic static state first; blinking is a best-effort enhancement.
let blinkingTimer = null;

// Icon paths for different alert states.
// NOTE: lamp-orange-* files are not yet in the repo. setIconSafe() falls back
// to the red icon until they are added.
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

const ICON_FALLBACK = { major: 'severe' };

const BADGE_COLORS = {
  test: '#0077ff',
  minor: '#FFD700',
  major: '#ff7700',
  severe: '#ff0000'
};

// Logger utility for production-appropriate logging
const logger = {
  info(message) {
    if (DEBUG) console.log('[VMA-INFO] ' + message);
  },
  warn(message) {
    console.warn('[VMA-WARN] ' + message);
  },
  error(message, error) {
    console.error('[VMA-ERROR] ' + message, error);
  },
  important(message) {
    console.log('[VMA-IMPORTANT] ' + message);
  }
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  logger.important(`VMA Monitor installed/updated to v${VERSION}`);

  if (details.reason === 'update') {
    logger.important(`Updated from version ${details.previousVersion} to ${VERSION}`);
    await performMigration(details.previousVersion);
  }

  await setDefaultOptions();
  await setIconSafe('default');
  await ensureAlarms();
  await syncBannerRegistration();

  // Do a first check shortly after install/update so the icon reflects reality.
  setTimeout(safeCheckForAlerts, 2000);
});

chrome.runtime.onStartup.addListener(() => {
  logger.important(`VMA Monitor v${VERSION} starting up`);
  setTimeout(() => {
    safeCheckForAlerts();
    cleanOldAcknowledgedAlerts();
    cleanHistoryFromTestAlerts();
  }, STARTUP_DELAY);
});

// Runs every time the service worker wakes up (not only on install/startup).
ensureAlarms();

async function setDefaultOptions() {
  const result = await chrome.storage.sync.get(['geoCode', 'testMode', 'preferredLanguage']);
  const updates = {};
  if (!result.geoCode) updates.geoCode = '00'; // Default to all Sweden
  if (result.testMode === undefined) updates.testMode = false;
  if (result.preferredLanguage === undefined) {
    const browserLang = chrome.i18n.getUILanguage();
    updates.preferredLanguage = browserLang.startsWith('en') ? 'en' : 'sv';
    logger.important(`Setting default language to: ${updates.preferredLanguage} based on browser UI ${browserLang}`);
  }
  if (Object.keys(updates).length > 0) {
    await chrome.storage.sync.set(updates);
  }

  const local = await chrome.storage.local.get(['vmaHistory', 'bannerEnabled']);
  const localUpdates = {};
  if (!local.vmaHistory) localUpdates.vmaHistory = [];
  if (local.bannerEnabled === undefined) localUpdates.bannerEnabled = false;
  if (Object.keys(localUpdates).length > 0) {
    await chrome.storage.local.set(localUpdates);
  }
}

// Perform migration when updating from an older version
async function performMigration(previousVersion) {
  try {
    if (compareVersions(previousVersion, '1.1') < 0) {
      logger.important('Performing migration to v1.1 (adding language support)');
      const { preferredLanguage } = await chrome.storage.sync.get(['preferredLanguage']);
      if (preferredLanguage === undefined) {
        const browserLang = chrome.i18n.getUILanguage();
        const newPreferredLanguage = browserLang.startsWith('en') ? 'en' : 'sv';
        await chrome.storage.sync.set({ preferredLanguage: newPreferredLanguage });
        logger.important(`Migration: Added preferredLanguage setting: ${newPreferredLanguage}`);
      }
    }

    if (compareVersions(previousVersion, '1.3') < 0) {
      logger.important('Performing migration to v1.3 (page banner setting)');
      // Banner is opt-in and off by default; nothing else to migrate.
      await chrome.storage.local.set({ bannerEnabled: false, bannerDismissed: [] });
    }
  } catch (error) {
    logger.error('Error during migration', error);
  }
}

// Make sure the periodic alarms exist (alarms survive restarts, but not
// necessarily a reinstall or a cleared profile).
async function ensureAlarms() {
  try {
    const poll = await chrome.alarms.get('pollVMA');
    if (!poll) {
      chrome.alarms.create('pollVMA', { periodInMinutes: POLL_INTERVAL });
    }
    const clean = await chrome.alarms.get('cleanOldAlerts');
    if (!clean) {
      chrome.alarms.create('cleanOldAlerts', { periodInMinutes: 1440 }); // 24 hours
    }
  } catch (error) {
    logger.error('Error ensuring alarms', error);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollVMA') {
    safeCheckForAlerts();
  } else if (alarm.name === 'cleanOldAlerts') {
    cleanOldAcknowledgedAlerts();
    cleanHistoryFromTestAlerts();
  }
});

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

// Rensa historiken från test-VMA
async function cleanHistoryFromTestAlerts() {
  try {
    const { vmaHistory = [] } = await chrome.storage.local.get(['vmaHistory']);
    if (vmaHistory.length === 0) return;

    const filteredHistory = vmaHistory.filter(alert => !isTestAlert(alert));
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
    if (acknowledgedAlerts.length === 0) return;

    const now = Date.now();

    // Entries are stored as "<identifier>::<timestamp>". Add a timestamp to legacy entries.
    const alertsWithTimestamp = acknowledgedAlerts.map(entry =>
      entry.includes('::') ? entry : `${entry}::${now}`
    );

    const newAcknowledgedAlerts = alertsWithTimestamp.filter(entry => {
      const [, timestampStr] = entry.split('::');
      const timestamp = parseInt(timestampStr, 10);
      if (Number.isNaN(timestamp)) return true;
      return now - timestamp < OLD_ALERT_THRESHOLD;
    });

    if (newAcknowledgedAlerts.length !== acknowledgedAlerts.length ||
        alertsWithTimestamp.some((entry, i) => entry !== acknowledgedAlerts[i])) {
      logger.important(`Cleaned up ${alertsWithTimestamp.length - newAcknowledgedAlerts.length} old acknowledged alerts`);
      await chrome.storage.local.set({ acknowledgedAlerts: newAcknowledgedAlerts });
    }
  } catch (error) {
    logger.error('Error cleaning old acknowledged alerts:', error);
  }
}

// ---------------------------------------------------------------------------
// Icon and badge
// ---------------------------------------------------------------------------

// Set the toolbar icon, falling back if the image files are missing.
async function setIconSafe(iconType) {
  const path = ICONS[iconType] || ICONS.default;
  try {
    await chrome.action.setIcon({ path });
  } catch (error) {
    const fallback = ICON_FALLBACK[iconType];
    if (fallback) {
      logger.warn(`Icon "${iconType}" could not be set, falling back to "${fallback}"`);
      try {
        await chrome.action.setIcon({ path: ICONS[fallback] });
        return;
      } catch (fallbackError) {
        logger.error('Fallback icon failed too', fallbackError);
      }
    } else {
      logger.error(`Failed to set icon "${iconType}"`, error);
    }
  }
}

function stopBlinking() {
  if (blinkingTimer) {
    clearInterval(blinkingTimer);
    blinkingTimer = null;
  }
}

// Update the badge for the given icon type. The badge always ends up in a
// stable state (static text) even if the worker is suspended mid-blink.
function updateBadge(iconType, isSilent = false) {
  stopBlinking();

  if (iconType === 'default' || isSilent) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[iconType] || '#ff0000' });
  chrome.action.setBadgeText({ text: '!' });

  // Best-effort blinking while the worker is alive.
  const frames = iconType === 'severe' ? ['!', 'VMA'] : ['!', ''];
  let index = 0;
  blinkingTimer = setInterval(() => {
    index = (index + 1) % frames.length;
    chrome.action.setBadgeText({ text: frames[index] });
  }, BLINK_INTERVAL);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function createVMANotification(alert, iconType) {
  if (!alert || !alert.info || alert.info.length === 0) return;

  try {
    const { preferredLanguage = 'sv' } = await chrome.storage.sync.get(['preferredLanguage']);
    const { info } = findBestMatchingInfo(alert.info, preferredLanguage);

    const title = info.event || chrome.i18n.getMessage('notificationTitle');
    let message = info.description || chrome.i18n.getMessage('noDetailedInfo');
    if (message.length > 150) {
      message = message.substring(0, 147) + '...';
    }

    let contextMessage = '';
    if (info.area && info.area.length > 0) {
      const areas = info.area.map(a => a.areaDesc).join(', ');
      contextMessage = `${chrome.i18n.getMessage('affectedAreas')}: ${areas}`;
    }

    const iconUrl = (ICONS[iconType] && iconType !== 'major') ? ICONS[iconType][128] : ICONS.severe[128];

    chrome.notifications.create('vma-alert', {
      type: 'basic',
      iconUrl,
      title,
      message,
      contextMessage,
      priority: 2,
      requireInteraction: true,
      silent: false
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
  }
}

// Show a notification for the first severe alert that has not been acknowledged.
async function maybeNotify(alerts, iconType) {
  try {
    const { acknowledgedAlerts = [], silentMode = false } =
      await chrome.storage.local.get(['acknowledgedAlerts', 'silentMode']);

    if (silentMode) {
      logger.info('Silent mode active, skipping notification');
      return;
    }

    const unacknowledgedSevere = alerts.filter(alert =>
      isSevereAlert(alert) && !isAcknowledged(alert, acknowledgedAlerts)
    );

    if (unacknowledgedSevere.length > 0) {
      await createVMANotification(unacknowledgedSevere[0], iconType);
    }
  } catch (error) {
    logger.error('Error checking for notifications:', error);
  }
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId !== 'vma-alert') return;
  chrome.notifications.clear(notificationId);

  const showGuide = () => {
    chrome.notifications.create('vma-popup-guide', {
      type: 'basic',
      iconUrl: ICONS.severe[128],
      title: chrome.i18n.getMessage('clickVmaIcon'),
      message: chrome.i18n.getMessage('clickIconDetails'),
      priority: 2
    });
  };

  // openPopup() requires a user gesture in most browsers and may reject.
  if (chrome.action.openPopup) {
    Promise.resolve()
      .then(() => chrome.action.openPopup())
      .catch(error => {
        logger.info('Could not open popup from notification: ' + error);
        showGuide();
      });
  } else {
    showGuide();
  }
});

// ---------------------------------------------------------------------------
// Fetching and processing alerts
// ---------------------------------------------------------------------------

function safeCheckForAlerts() {
  checkForAlerts().catch(err => {
    logger.error('Error in checkForAlerts:', err);
  });
}

async function checkForAlerts() {
  const { geoCode, testMode } = await chrome.storage.sync.get(['geoCode', 'testMode']);
  logger.info(`Checking for alerts - Test mode: ${testMode}, Region: ${geoCode}`);

  try {
    const url = buildApiUrl(geoCode, testMode);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    logger.info(`Received data with ${alerts.length} alerts`);

    if (testMode && alerts.length === 0) {
      await processAlerts([createTestAlert()], testMode);
    } else {
      await processAlerts(alerts, testMode);
    }

    if (testMode) {
      cleanHistoryFromTestAlerts();
    }
  } catch (error) {
    logger.error('Error checking VMA alerts:', error);
    // On network errors we keep the previously stored alerts (do not clear the
    // icon just because the API was unreachable). In test mode, show a fake alert.
    if (testMode) {
      await processAlerts([createTestAlert()], testMode);
    }
  }
}

function createTestAlert() {
  return {
    identifier: 'TEST-VMA-' + Date.now(),
    sender: 'VMA Monitor Extension',
    sent: new Date().toISOString(),
    status: 'Test',
    msgType: 'Alert',
    scope: 'Public',
    info: [
      {
        language: 'sv-SE',
        category: 'Safety',
        event: 'Test VMA',
        urgency: 'Expected',
        severity: 'Minor',
        certainty: 'Likely',
        senderName: 'VMA Monitor Extension',
        description: 'Detta är ett test av VMA Monitor. Vid ett riktigt VMA skulle viktig information visas här.',
        area: [{ areaDesc: 'Test Region' }]
      },
      {
        language: 'en-US',
        category: 'Safety',
        event: 'Test Emergency Alert',
        urgency: 'Expected',
        severity: 'Minor',
        certainty: 'Likely',
        senderName: 'VMA Monitor Extension',
        description: 'This is a test of the VMA Monitor. In case of a real emergency, important information would be displayed here.',
        area: [{ areaDesc: 'Test Region' }]
      }
    ]
  };
}

function buildApiUrl(geoCode, testMode) {
  if (testMode) {
    return TEST_API_URL;
  }
  if (geoCode && geoCode !== '00') {
    return `${API_URL}/${encodeURIComponent(geoCode)}`;
  }
  return API_URL;
}

// Uppdatera VMA-historik
async function updateVmaHistory(expiredAlerts) {
  try {
    const nonTestAlerts = expiredAlerts.filter(alert => !isTestAlert(alert));
    if (nonTestAlerts.length === 0) return;

    const { vmaHistory = [] } = await chrome.storage.local.get(['vmaHistory']);
    const expiredAt = new Date().toISOString();
    const timeStampedAlerts = nonTestAlerts.map(alert => ({ ...alert, expiredAt }));
    const filteredHistory = vmaHistory.filter(alert => !isTestAlert(alert));

    const newHistory = [...timeStampedAlerts, ...filteredHistory]
      .sort((a, b) => new Date(b.expiredAt || b.sent) - new Date(a.expiredAt || a.sent))
      .slice(0, MAX_HISTORY_ITEMS);

    await chrome.storage.local.set({ vmaHistory: newHistory });
    logger.important(`VMA history updated, now contains ${newHistory.length} items`);
  } catch (error) {
    logger.error('Error updating VMA history:', error);
  }
}

// Process alerts from the API response
async function processAlerts(alerts, isTestMode) {
  const { activeAlerts: previousActiveAlerts = [] } = await chrome.storage.local.get(['activeAlerts']);

  // Only Actual/Test alerts of type Alert are shown
  const activeAlerts = alerts.filter(alert =>
    (alert.status === 'Actual' || alert.status === 'Test') && alert.msgType === 'Alert'
  );

  // Move alerts that are no longer active into the history (real alerts only)
  if (!isTestMode) {
    const expiredAlerts = previousActiveAlerts.filter(prevAlert =>
      !activeAlerts.some(newAlert => newAlert.identifier === prevAlert.identifier) &&
      !isTestAlert(prevAlert)
    );
    if (expiredAlerts.length > 0) {
      await updateVmaHistory(expiredAlerts);
    }
  }

  if (activeAlerts.length === 0) {
    await chrome.storage.local.set({ activeAlerts: [], silentMode: false, bannerDismissed: [] });
    await setIconSafe('default');
    updateBadge('default');
    return;
  }

  // Drop banner dismissals for alerts that are no longer active
  const { bannerDismissed = [], silentMode = false } =
    await chrome.storage.local.get(['bannerDismissed', 'silentMode']);
  const activeIds = new Set(activeAlerts.map(a => a.identifier));
  const stillDismissed = bannerDismissed.filter(id => activeIds.has(id));

  await chrome.storage.local.set({ activeAlerts, bannerDismissed: stillDismissed });

  const iconType = determineIconType(activeAlerts);
  await setIconSafe(iconType);
  updateBadge(iconType, silentMode);

  if (iconType === 'severe') {
    await maybeNotify(activeAlerts, iconType);
  }
}

// ---------------------------------------------------------------------------
// Page banner (opt-in content script)
// ---------------------------------------------------------------------------

async function hasBannerPermission() {
  try {
    return await chrome.permissions.contains({ origins: BANNER_ORIGINS });
  } catch (error) {
    logger.error('Error checking banner permission', error);
    return false;
  }
}

async function isBannerScriptRegistered() {
  try {
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [BANNER_SCRIPT_ID] });
    return scripts.length > 0;
  } catch {
    return false;
  }
}

// Bring the registered content script in line with the setting and the
// granted permission. Called on install, on toggle and when permissions change.
async function syncBannerRegistration() {
  try {
    const { bannerEnabled = false } = await chrome.storage.local.get(['bannerEnabled']);
    const permitted = await hasBannerPermission();
    const registered = await isBannerScriptRegistered();

    if (bannerEnabled && !permitted) {
      // Permission was revoked (e.g. from the extensions page): turn the feature off.
      logger.warn('Banner enabled but host permission missing; disabling banner');
      await chrome.storage.local.set({ bannerEnabled: false });
    }

    const shouldBeRegistered = bannerEnabled && permitted;

    if (shouldBeRegistered && !registered) {
      await chrome.scripting.registerContentScripts([{
        id: BANNER_SCRIPT_ID,
        js: [BANNER_SCRIPT_FILE],
        matches: BANNER_ORIGINS,
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true
      }]);
      logger.important('Page banner content script registered');
    } else if (!shouldBeRegistered && registered) {
      await chrome.scripting.unregisterContentScripts({ ids: [BANNER_SCRIPT_ID] });
      logger.important('Page banner content script unregistered');
    }

    return shouldBeRegistered;
  } catch (error) {
    logger.error('Error syncing banner registration', error);
    return false;
  }
}

// Inject the banner into tabs that are already open so the user sees the
// effect immediately after enabling. Tabs we cannot script are skipped.
async function injectBannerIntoOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: BANNER_ORIGINS });
    await Promise.all(tabs.map(tab =>
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [BANNER_SCRIPT_FILE]
      }).catch(() => { /* chrome://, store pages, discarded tabs etc. */ })
    ));
  } catch (error) {
    logger.error('Error injecting banner into open tabs', error);
  }
}

// Tell already-injected banners to remove themselves.
async function removeBannerFromOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: BANNER_ORIGINS });
    await Promise.all(tabs.map(tab =>
      chrome.tabs.sendMessage(tab.id, { action: 'vmaBannerRemove' }).catch(() => {})
    ));
  } catch (error) {
    logger.error('Error removing banner from open tabs', error);
  }
}

async function setBannerEnabled(enabled) {
  await chrome.storage.local.set({ bannerEnabled: Boolean(enabled) });
  const active = await syncBannerRegistration();
  if (active) {
    await injectBannerIntoOpenTabs();
  } else {
    await removeBannerFromOpenTabs();
  }
  return active;
}

chrome.permissions.onRemoved.addListener(() => {
  syncBannerRegistration();
});

chrome.permissions.onAdded.addListener(() => {
  syncBannerRegistration();
});

// ---------------------------------------------------------------------------
// Messages from popup, options page and content script
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.action) {
    case 'checkForAlerts':
      checkForAlerts()
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          logger.error('Manual check failed', error);
          sendResponse({ success: false });
        });
      return true;

    case 'testAlert':
      toggleTestMode()
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          logger.error('Toggle test mode failed', error);
          sendResponse({ success: false });
        });
      return true;

    case 'silenceAlerts':
      enableSilentMode()
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
      return true;

    case 'clearHistory':
      chrome.storage.local.set({ vmaHistory: [] }, () => sendResponse({ success: true }));
      return true;

    case 'getVersion':
      sendResponse({ version: VERSION });
      return false;

    case 'setBannerEnabled':
      setBannerEnabled(message.enabled)
        .then(active => sendResponse({ success: true, active }))
        .catch(error => {
          logger.error('Failed to set banner state', error);
          sendResponse({ success: false });
        });
      return true;

    case 'dismissBanner': {
      // From the content script: hide the banner for these alerts in all tabs
      const ids = Array.isArray(message.identifiers) ? message.identifiers.filter(id => typeof id === 'string') : [];
      chrome.storage.local.get(['bannerDismissed']).then(({ bannerDismissed = [] }) => {
        const merged = Array.from(new Set([...bannerDismissed, ...ids]));
        return chrome.storage.local.set({ bannerDismissed: merged });
      }).then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    default:
      return false;
  }
});

// Aktivera tyst läge för aktuella VMA (efter kvittering)
async function enableSilentMode() {
  try {
    chrome.notifications.getAll((notifications) => {
      Object.keys(notifications || {}).forEach(id => chrome.notifications.clear(id));
    });

    const { activeAlerts = [] } = await chrome.storage.local.get(['activeAlerts']);
    await chrome.storage.local.set({ silentMode: true });

    if (activeAlerts.length > 0) {
      updateBadge(determineIconType(activeAlerts), true);
    }
    logger.important('Silent mode enabled - notifications cleared and blinking stopped');
  } catch (error) {
    logger.error('Error enabling silent mode:', error);
  }
}

// Toggle test mode for alert visualization
async function toggleTestMode() {
  const { testMode: current = false } = await chrome.storage.sync.get(['testMode']);
  const testMode = !current;
  logger.info(`Toggling test mode: ${testMode}`);

  await chrome.storage.local.set({ silentMode: false });

  if (testMode) {
    await setIconSafe('test');
    cleanHistoryFromTestAlerts();
  }

  await chrome.storage.sync.set({ testMode });
  await checkForAlerts();
}
