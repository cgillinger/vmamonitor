// Shared helpers used by the background service worker and the popup.
// Loaded as an ES module. The content script (content/banner.js) cannot import
// modules, so it carries its own minimal copies of the few helpers it needs.

export const SEVERITY_RANK = {
  Unknown: 0,
  Minor: 1,
  Moderate: 2,
  Severe: 3,
  Extreme: 4
};

// Maps CAP severity to the icon/badge type used throughout the extension.
export const SEVERITY_TO_ICON_TYPE = {
  Minor: 'minor',
  Moderate: 'major',
  Severe: 'severe',
  Extreme: 'severe'
};

// Matches "test", "TEST", "Testlarm", "testsändning" but not "protest"/"attest".
const TEST_WORD = /\btest/i;

// Decide whether an alert is a test alert. Real alerts that merely mention
// the word inside another word (e.g. "protest") are not treated as tests.
export function isTestAlert(alert) {
  if (!alert) return false;
  if (alert.status === 'Test') return true;
  if (alert.identifier && TEST_WORD.test(alert.identifier)) return true;

  if (Array.isArray(alert.info)) {
    return alert.info.some(info =>
      TEST_WORD.test(info.event || '') || TEST_WORD.test(info.description || '')
    );
  }
  return false;
}

// Pick the info object that best matches the preferred language.
// Returns { info, langCode } where langCode is 'sv' or 'en'.
export function findBestMatchingInfo(infoArray, preferredLanguage = 'sv') {
  if (!Array.isArray(infoArray) || infoArray.length === 0) {
    return { info: {}, langCode: preferredLanguage === 'en' ? 'en' : 'sv' };
  }

  const sv = infoArray.find(info => info.language === 'sv-SE');
  const en = infoArray.find(info => info.language === 'en-US');
  const order = preferredLanguage === 'en' ? [en, sv] : [sv, en];

  for (const info of order) {
    if (info) {
      return { info, langCode: info.language === 'en-US' ? 'en' : 'sv' };
    }
  }

  const first = infoArray[0];
  return { info: first, langCode: first.language === 'en-US' ? 'en' : 'sv' };
}

// Highest CAP severity string across all info objects of an alert.
export function getAlertSeverity(alert) {
  let best = 'Unknown';
  for (const info of alert?.info || []) {
    if ((SEVERITY_RANK[info.severity] || 0) > SEVERITY_RANK[best]) {
      best = info.severity;
    }
  }
  return best;
}

export function isSevereAlert(alert) {
  return SEVERITY_RANK[getAlertSeverity(alert)] >= SEVERITY_RANK.Severe;
}

// Icon type ('default' | 'minor' | 'major' | 'severe' | 'test') for a set of alerts.
export function determineIconType(alerts) {
  if (!alerts || alerts.length === 0) return 'default';
  if (alerts.some(alert => alert.status === 'Test')) return 'test';

  let highest = 'Unknown';
  for (const alert of alerts) {
    const severity = getAlertSeverity(alert);
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[highest]) highest = severity;
  }
  return SEVERITY_TO_ICON_TYPE[highest] || 'default';
}

// Acknowledged alerts are stored as "<identifier>::<timestamp>".
export function stripAckTimestamp(entry) {
  return typeof entry === 'string' && entry.includes('::') ? entry.split('::')[0] : entry;
}

export function isAcknowledged(alert, acknowledgedAlerts = []) {
  const ids = acknowledgedAlerts.map(stripAckTimestamp);
  return ids.includes(alert.identifier);
}

// Compare dotted version strings: negative if a < b, 0 if equal, positive if a > b.
export function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getExtensionVersion() {
  return chrome.runtime.getManifest().version;
}
