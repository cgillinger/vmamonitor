document.addEventListener('DOMContentLoaded', init);

const DEBUG = false; // Set to false in production
const VERSION = '1.2'; // Updated to version 1.2

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

// Lokalisera UI
function localizeUI() {
  try {
    // Get preferred language
    chrome.storage.sync.get(['preferredLanguage'], (result) => {
      const lang = result.preferredLanguage || 'sv';
      updateLanguageUI(lang);
    });
  } catch (error) {
    logger.error('Error localizing UI:', error);
  }
}

// Update UI elements with correct language
function updateLanguageUI(lang) {
  try {
    // Update page language attribute for screen readers
    document.documentElement.lang = lang;
    
    // Update page title
    document.title = chrome.i18n.getMessage('settingsTitle') || 'VMA Notifieringar - Inställningar';
    
    // Update h1
    document.querySelector('header h1').textContent = chrome.i18n.getMessage('settingsTitle') || 'VMA Notifieringar - Inställningar';
    
    // Update region label
    document.querySelector('label[for="region-select"]').textContent = chrome.i18n.getMessage('regionLabel') || 'Region för övervakning:';
    
    // Update region hint
    document.querySelectorAll('.hint')[0].textContent = chrome.i18n.getMessage('regionHint') || 
      'Välj region för att övervaka VMA-meddelanden. Välj "Hela Sverige" för att övervaka alla regioner.';
    
    // Update language label
    document.querySelector('label[for="language-select"]').textContent = chrome.i18n.getMessage('languageLabel') || 'Föredraget språk:';
    
    // Update language hint
    document.querySelectorAll('.hint')[1].textContent = chrome.i18n.getMessage('languageHint') || 
      'Välj föredraget språk för VMA-meddelanden. Engelska översättningar visas när de finns tillgängliga.';
    
    // Update interval label
    document.querySelector('label[for="check-interval"]').textContent = chrome.i18n.getMessage('intervalLabel') || 'Uppdateringsintervall:';
    
    // Update interval info
    document.querySelector('.info-text').textContent = chrome.i18n.getMessage('intervalInfo') || 'VMA-API:et kontrolleras var 5:e minut';
    
    // Update save button
    document.getElementById('save-btn').textContent = chrome.i18n.getMessage('saveButton') || 'Spara inställningar';
    
    // Update What's New section for v1.2
    const whatsNewSection = document.querySelector('.what-is-new');
    if (whatsNewSection) {
      whatsNewSection.querySelector('h2').textContent = lang === 'sv' ? 'Nyheter i version 1.2' : 'What\'s new in version 1.2';
      
      const list = whatsNewSection.querySelector('ul');
      list.innerHTML = '';
      
      const newFeatures = lang === 'sv' ? [
        'Förbättrad tillgänglighet för skärmläsare och tangentbordsnavigering',
        'ARIA-etiketter och live regions för bättre skärmläsarstöd',
        'Tangentbordsgenvägar och fokusindikatorer',
        'Stöd för "high contrast" och "reduced motion" preferenser',
        'Förbättrade notifikationer till skärmläsare',
        'Bättre strukturering av innehåll för hjälpmedel'
      ] : [
        'Improved accessibility for screen readers and keyboard navigation',
        'ARIA labels and live regions for better screen reader support',
        'Keyboard shortcuts and focus indicators',
        'Support for "high contrast" and "reduced motion" preferences',
        'Enhanced screen reader announcements',
        'Better content structure for assistive technology'
      ];
      
      newFeatures.forEach(feature => {
        const li = document.createElement('li');
        li.textContent = feature;
        list.appendChild(li);
      });
    }
    
    // Update footer
    const footer = document.querySelector('footer p');
    const footerLink = footer.querySelector('a');
    const linkHref = footerLink.getAttribute('href');
    const linkText = footerLink.textContent;
    
    footer.innerHTML = '';
    footer.textContent = 'VMA Notifieringar v' + VERSION + ' - ' + (chrome.i18n.getMessage('usesApi') || 'Använder') + ' ';
    
    const newLink = document.createElement('a');
    newLink.href = linkHref;
    newLink.textContent = linkText;
    newLink.target = '_blank';
    
    footer.appendChild(newLink);
  } catch (error) {
    logger.error('Error updating language UI:', error);
  }
}

// Initialize the options page
async function init() {
  try {
    await localizeUI();
    await loadSettings();
    setupEventListeners();
    setupAccessibility();
    logger.info('Options page initialized');
  } catch (error) {
    logger.error('Error initializing options page:', error);
  }
}

// Setup accessibility features
function setupAccessibility() {
  // Add keyboard navigation
  document.addEventListener('keydown', (event) => {
    // Escape key to close options (if in popup mode)
    if (event.key === 'Escape' && window.opener !== null) {
      window.close();
    }
  });
  
  // Add focus indicators
  const focusableElements = document.querySelectorAll('select, button');
  focusableElements.forEach(element => {
    element.addEventListener('focus', () => {
      element.style.outline = '2px solid #054a91';
      element.style.outlineOffset = '2px';
    });
    
    element.addEventListener('blur', () => {
      element.style.outline = 'none';
    });
  });
}

// Load saved settings
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(['geoCode', 'preferredLanguage']);
    
    // Set region select value
    const regionSelect = document.getElementById('region-select');
    if (settings.geoCode) {
      regionSelect.value = settings.geoCode;
      logger.info(`Loaded region setting: ${settings.geoCode}`);
    } else {
      logger.info('No region setting found, using default');
    }
    
    // Set language select value
    const languageSelect = document.getElementById('language-select');
    if (settings.preferredLanguage) {
      languageSelect.value = settings.preferredLanguage;
      logger.info(`Loaded language setting: ${settings.preferredLanguage}`);
    } else {
      logger.info('No language setting found, using default');
    }
  } catch (error) {
    logger.error('Error loading settings:', error);
    showStatus(chrome.i18n.getMessage('errorMessage') || 'Kunde inte ladda inställningar', true);
  }
}

// Set up event listeners
function setupEventListeners() {
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('language-select').addEventListener('change', onLanguageChange);
  logger.info('Event listeners set up');
}

// Handle language change
function onLanguageChange(event) {
  const newLanguage = event.target.value;
  updateLanguageUI(newLanguage);
}

// Save settings with accessibility announcements
async function saveSettings() {
  try {
    const geoCode = document.getElementById('region-select').value;
    const preferredLanguage = document.getElementById('language-select').value;
    
    logger.important(`Saving settings - Region: ${geoCode}, Language: ${preferredLanguage}`);
    
    await chrome.storage.sync.set({ geoCode, preferredLanguage });
    
    // Trigger a refresh in the background script
    chrome.runtime.sendMessage({ action: 'checkForAlerts' });
    
    const successMessage = chrome.i18n.getMessage('savedMessage') || 'Inställningar sparade!';
    showStatus(successMessage);
    
    // Announce to screen reader
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      const utterance = new SpeechSynthesisUtterance(successMessage);
      utterance.lang = preferredLanguage === 'en' ? 'en-US' : 'sv-SE';
      utterance.volume = 0.5;
      window.speechSynthesis.speak(utterance);
    }
    
    // Om detta är ett popup-fönster, stäng det efter en kort fördröjning
    if (window.opener !== null || window.history.length <= 1) {
      setTimeout(() => {
        window.close();
      }, 1500);
    }
  } catch (error) {
    logger.error('Error saving settings:', error);
    showStatus(chrome.i18n.getMessage('errorMessage') || 'Kunde inte spara inställningar', true);
  }
}

// Show status message with enhanced accessibility
function showStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.remove('hidden');
  
  // Add ARIA live region attributes
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  status.setAttribute('aria-atomic', 'true');
  
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
    status.removeAttribute('role');
    status.removeAttribute('aria-live');
    status.removeAttribute('aria-atomic');
  }, 3000);
}