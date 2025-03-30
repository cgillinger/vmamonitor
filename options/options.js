document.addEventListener('DOMContentLoaded', init);

// Initialize the options page
async function init() {
  await loadSettings();
  setupEventListeners();
}

// Load saved settings
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(['geoCode']);
    
    // Set region select value
    const regionSelect = document.getElementById('region-select');
    if (settings.geoCode) {
      regionSelect.value = settings.geoCode;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Kunde inte ladda inställningar', true);
  }
}

// Set up event listeners
function setupEventListeners() {
  document.getElementById('save-btn').addEventListener('click', saveSettings);
}

// Save settings
async function saveSettings() {
  try {
    const geoCode = document.getElementById('region-select').value;
    
    await chrome.storage.sync.set({ geoCode });
    
    // Trigger a refresh in the background script
    chrome.runtime.sendMessage({ action: 'checkForAlerts' });
    
    showStatus('Inställningar sparade!');
  } catch (error) {
    console.error('Error saving settings:', error);
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
  } else {
    status.classList.remove('error');
  }
  
  // Hide status after 3 seconds
  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}