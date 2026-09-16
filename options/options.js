import { getExtensionVersion } from '../shared/vma-utils.js';

document.addEventListener('DOMContentLoaded', init);

const DEBUG = false; // Set to false in production
const VERSION = getExtensionVersion(); // Single source of truth: manifest.json
const BANNER_ORIGINS = ['http://*/*', 'https://*/*'];
const WHATS_NEW_KEYS = ['whatsNew13_1', 'whatsNew13_2', 'whatsNew13_3', 'whatsNew13_4', 'whatsNew13_5'];

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
// Localisation
//
// chrome.i18n.getMessage() always follows the browser UI language. This page
// should follow the language the user picked in the extension, so we load the
// matching _locales/<lang>/messages.json ourselves and fall back to chrome.i18n.
// ---------------------------------------------------------------------------

const messageCache = {};

async function loadMessages(lang) {
  if (messageCache[lang]) return messageCache[lang];
  try {
    const response = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    messageCache[lang] = await response.json();
  } catch (error) {
    logger.warn(`Could not load messages for "${lang}": ${error}`);
    messageCache[lang] = {};
  }
  return messageCache[lang];
}

let messages = {};

function t(key, fallback = '') {
  return messages[key]?.message || chrome.i18n.getMessage(key) || fallback;
}

async function applyLanguage(lang) {
  messages = await loadMessages(lang === 'en' ? 'en' : 'sv');
  document.documentElement.lang = lang;
  document.title = t('settingsTitle', document.title);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const text = t(el.dataset.i18n);
    if (text) el.textContent = text;
  });

  document.getElementById('whats-new-title').textContent = `${t('whatsNewTitle', 'Nyheter i version')} ${VERSION}`;
  const list = document.getElementById('whats-new-list');
  list.replaceChildren();
  WHATS_NEW_KEYS.forEach(key => {
    const text = t(key);
    if (!text) return;
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });

  document.getElementById('version-badge').textContent = `v${VERSION}`;
  document.getElementById('footer-text').textContent = `VMA Notifieringar v${VERSION}`;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  try {
    const { preferredLanguage = 'sv' } = await chrome.storage.sync.get(['preferredLanguage']);
    await applyLanguage(preferredLanguage);
    await loadSettings();
    await loadBannerState();
    setupEventListeners();
    setupAccessibility();
    logger.info('Options page initialized');
  } catch (error) {
    logger.error('Error initializing options page:', error);
  }
}

function setupAccessibility() {
  document.addEventListener('keydown', (event) => {
    // Escape closes the page when it was opened as a separate window
    if (event.key === 'Escape' && window.opener !== null) {
      window.close();
    }
  });
}

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(['geoCode', 'preferredLanguage']);
    if (settings.geoCode) {
      document.getElementById('region-select').value = settings.geoCode;
    }
    if (settings.preferredLanguage) {
      document.getElementById('language-select').value = settings.preferredLanguage;
    }
  } catch (error) {
    logger.error('Error loading settings:', error);
    showStatus('status', t('errorMessage', 'Kunde inte ladda inställningar'), true);
  }
}

function setupEventListeners() {
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('language-select').addEventListener('change', (event) => {
    applyLanguage(event.target.value);
  });
  document.getElementById('banner-toggle').addEventListener('change', onBannerToggle);

  // Reflect changes made elsewhere (e.g. permission revoked from the extensions page)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'bannerEnabled' in changes) {
      document.getElementById('banner-toggle').checked = Boolean(changes.bannerEnabled.newValue);
    }
  });
}

async function saveSettings() {
  try {
    const geoCode = document.getElementById('region-select').value;
    const preferredLanguage = document.getElementById('language-select').value;

    logger.important(`Saving settings - Region: ${geoCode}, Language: ${preferredLanguage}`);
    await chrome.storage.sync.set({ geoCode, preferredLanguage });

    // Trigger a refresh in the background script
    chrome.runtime.sendMessage({ action: 'checkForAlerts' }, () => void chrome.runtime.lastError);

    showStatus('status', t('savedMessage', 'Inställningar sparade!'));
  } catch (error) {
    logger.error('Error saving settings:', error);
    showStatus('status', t('errorMessage', 'Kunde inte spara inställningar'), true);
  }
}

// ---------------------------------------------------------------------------
// Page banner (opt-in). Saved immediately: the permission prompt must be
// triggered by the user's click, so it cannot wait for the Save button.
// ---------------------------------------------------------------------------

async function loadBannerState() {
  const toggle = document.getElementById('banner-toggle');
  try {
    const [{ bannerEnabled = false }, permitted] = await Promise.all([
      chrome.storage.local.get(['bannerEnabled']),
      chrome.permissions.contains({ origins: BANNER_ORIGINS })
    ]);
    toggle.checked = Boolean(bannerEnabled && permitted);
    if (bannerEnabled && !permitted) {
      // Permission was revoked outside the extension; make storage consistent.
      sendBannerState(false);
    }
  } catch (error) {
    logger.error('Error loading banner state:', error);
    toggle.checked = false;
  }
}

function sendBannerState(enabled) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'setBannerEnabled', enabled }, (response) => {
      if (chrome.runtime.lastError) {
        logger.error('Background did not respond', chrome.runtime.lastError);
        resolve({ success: false });
        return;
      }
      resolve(response || { success: false });
    });
  });
}

async function onBannerToggle(event) {
  const toggle = event.target;
  const wanted = toggle.checked;
  toggle.disabled = true;

  try {
    if (wanted) {
      const granted = await chrome.permissions.request({ origins: BANNER_ORIGINS });
      if (!granted) {
        toggle.checked = false;
        showStatus('banner-status', t('bannerPermissionDenied', 'Behörigheten nekades.'), true);
        return;
      }
      const result = await sendBannerState(true);
      if (!result.success || !result.active) {
        toggle.checked = false;
        showStatus('banner-status', t('bannerError', 'Kunde inte ändra inställningen'), true);
        return;
      }
      showStatus('banner-status', t('bannerEnabled', 'Varningsbalken är aktiverad'));
    } else {
      const result = await sendBannerState(false);
      // Also drop the broad host permission so the extension holds no more access than needed.
      try {
        await chrome.permissions.remove({ origins: BANNER_ORIGINS });
      } catch (error) {
        logger.warn('Could not remove host permission: ' + error);
      }
      if (!result.success) {
        showStatus('banner-status', t('bannerError', 'Kunde inte ändra inställningen'), true);
        return;
      }
      showStatus('banner-status', t('bannerDisabled', 'Varningsbalken är avstängd'));
    }
  } catch (error) {
    logger.error('Error toggling banner:', error);
    toggle.checked = false;
    showStatus('banner-status', t('bannerError', 'Kunde inte ändra inställningen'), true);
  } finally {
    toggle.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Status messages
// ---------------------------------------------------------------------------

const statusTimers = {};

function showStatus(elementId, message, isError = false) {
  const status = document.getElementById(elementId);
  if (!status) return;

  status.textContent = message;
  status.classList.remove('hidden');
  status.classList.toggle('error', isError);
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  status.setAttribute('aria-atomic', 'true');

  if (isError) {
    logger.error(`Status error: ${message}`);
  } else {
    logger.info(`Status message: ${message}`);
  }

  clearTimeout(statusTimers[elementId]);
  statusTimers[elementId] = setTimeout(() => {
    status.classList.add('hidden');
    status.removeAttribute('role');
    status.removeAttribute('aria-live');
    status.removeAttribute('aria-atomic');
  }, 4000);
}
