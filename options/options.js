document.addEventListener('DOMContentLoaded', init);

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

// Initialize the options page
async function init() {
  await loadSettings();
  setupEventListeners();
  logger.info('Options page initialized');
}

// Load saved settings
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(['geoCode']);
    
    // Set region select value
    const regionSelect = document.getElementById('region-select');
    if (settings.geoCode) {
      regionSelect.value = settings.geoCode;
      logger.info(`Loaded region setting: ${settings.geoCode}`);
    } else {
      logger.info('No region setting found, using default');
    }
  } catch (error) {
    logger.error('Error loading settings:', error);
    showStatus('Kunde inte ladda inställningar', true);
  }
}

// Set up event listeners
function setupEventListeners() {
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  logger.info('Event listeners set up');
}

// Save settings
async function saveSettings() {
  try {
    const geoCode = document.getElementById('region-select').value;
    logger.important(`Saving region setting: ${geoCode}`);
    
    await chrome.storage.sync.set({ geoCode });
    
    // Trigger a refresh in the background script
    chrome.runtime.sendMessage({ action: 'checkForAlerts' });
    
    showStatus('Inställningar sparade!');
  } catch (error) {
    logger.error('Error saving settings:', error);
    showStatus('Kunde inte spara inställningar', true);
  }
}

// Show status message
function showStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.remove('hidden');
  
  if (isError) {
    status.classList.add('error');
    logger.error(`Status error: ${message}`);
  } else {
    status.classList.remove('error');
    logger.info(`Status message: ${message}`);
  }
  
  // Hide status after 3 seconds
  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}