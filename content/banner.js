// VMA page banner (opt-in feature).
//
// Injected into ordinary http/https pages only when the user has enabled the
// banner in the extension settings and granted the optional host permission.
// It renders active VMA alerts as a fixed bar at the top of the page.
//
// Security notes:
// - All alert text is inserted with textContent, never innerHTML.
// - The UI lives in a closed Shadow DOM so page CSS cannot restyle it and the
//   banner cannot leak styles into the page.
// - The banner is informational only. A page owns its DOM and could remove or
//   cover the banner; OS notifications and the toolbar icon remain the
//   authoritative channels.
(() => {
  const HOST_ID = 'vma-notifieringar-banner-host';

  // Guard against double injection (registered script + executeScript on enable).
  if (window.__vmaBannerInstalled) return;
  window.__vmaBannerInstalled = true;

  const STRINGS = {
    sv: {
      label: 'VMA',
      test: 'TEST-VMA',
      affected: 'Berörda områden',
      wholeCountry: 'Hela landet',
      more: 'Visa mer',
      less: 'Visa mindre',
      acknowledge: 'Kvittera VMA',
      acknowledgeTitle: 'Kvittera för att stoppa blinkande notifiering men behålla varningsikonen. Balken tas bort på alla sidor.',
      count: (n) => `${n} aktiva VMA`,
      source: 'Källa: Sveriges Radio VMA'
    },
    en: {
      label: 'VMA',
      test: 'TEST ALERT',
      affected: 'Affected areas',
      wholeCountry: 'Whole country',
      more: 'Show more',
      less: 'Show less',
      acknowledge: 'Acknowledge Alert',
      acknowledgeTitle: 'Acknowledge to stop the blinking notification but keep the warning icon. The bar is removed on all pages.',
      count: (n) => `${n} active alerts`,
      source: 'Source: Sveriges Radio VMA'
    }
  };

  const SEVERITY_RANK = { Unknown: 0, Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 };
  const TEST_WORD = /\btest/i;

  // Kopia av resolveLanguage() i shared/vma-utils.js - content scripts kan inte
  // importera moduler. Ett osatt språk betyder "följ webbläsaren".
  function resolveLanguage(stored) {
    if (stored === 'sv' || stored === 'en') return stored;
    return chrome.i18n.getUILanguage().startsWith('en') ? 'en' : 'sv';
  }

  function isTestAlert(alert) {
    if (!alert) return false;
    if (alert.status === 'Test') return true;
    if (alert.identifier && TEST_WORD.test(alert.identifier)) return true;
    return (alert.info || []).some(info =>
      TEST_WORD.test(info.event || '') || TEST_WORD.test(info.description || '')
    );
  }

  function getAlertSeverity(alert) {
    let best = 'Unknown';
    for (const info of alert?.info || []) {
      if ((SEVERITY_RANK[info.severity] || 0) > SEVERITY_RANK[best]) best = info.severity;
    }
    return best;
  }

  function findBestMatchingInfo(infoArray, lang) {
    if (!Array.isArray(infoArray) || infoArray.length === 0) return {};
    const sv = infoArray.find(i => i.language === 'sv-SE');
    const en = infoArray.find(i => i.language === 'en-US');
    return (lang === 'en' ? (en || sv) : (sv || en)) || infoArray[0];
  }

  function severityClass(alerts) {
    if (alerts.some(a => a.status === 'Test')) return 'test';
    let highest = 'Unknown';
    for (const a of alerts) {
      const s = getAlertSeverity(a);
      if (SEVERITY_RANK[s] > SEVERITY_RANK[highest]) highest = s;
    }
    if (highest === 'Extreme' || highest === 'Severe') return 'severe';
    if (highest === 'Moderate') return 'major';
    if (highest === 'Minor') return 'minor';
    return 'severe'; // Unknown severity: treat as important
  }

  const CSS = `
    :host { all: initial; }
    .bar {
      position: fixed;
      top: 10px; left: 10px; right: 10px;
      z-index: 2147483647;
      box-sizing: border-box;
      max-width: 1100px;
      margin: 0 auto;
      max-height: calc(60vh - 20px);
      overflow-y: auto;
      border-radius: 14px;
      font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #fff;
      background: #c00000;
      box-shadow:
        0 12px 32px rgba(0,0,0,.30),
        0 2px 8px rgba(0,0,0,.22),
        inset 0 1px 0 rgba(255,255,255,.18);
      padding: 10px 14px;
      direction: ltr;
      text-align: left;
    }
    .bar.severe { background: #c00000; }
    .bar.major  { background: #d95d00; }
    .bar.minor  { background: #e6b800; color: #1a1a1a; }
    .bar.test   { background: #0060c0; }
    .row { display: flex; align-items: flex-start; gap: 10px; max-width: 1200px; margin: 0 auto; }
    .tag {
      flex: none;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: .04em;
      padding: 2px 8px;
      border-radius: 3px;
      background: rgba(255,255,255,.22);
      border: 1px solid rgba(255,255,255,.5);
      margin-top: 1px;
      white-space: nowrap;
    }
    .minor .tag { background: rgba(0,0,0,.12); border-color: rgba(0,0,0,.35); }
    .body { flex: 1 1 auto; min-width: 0; }
    .title { font-weight: 700; font-size: 15px; margin: 0 0 2px; }
    .desc { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
    .desc.clamped {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .meta { font-size: 12px; opacity: .92; margin: 4px 0 0; }
    .alert + .alert { border-top: 1px solid rgba(255,255,255,.35); margin-top: 8px; padding-top: 8px; }
    .minor .alert + .alert { border-top-color: rgba(0,0,0,.25); }
    .actions { flex: none; display: flex; gap: 6px; align-items: flex-start; }
    button {
      all: initial;
      font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: inherit;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.6);
      border-radius: 4px;
      padding: 6px 10px;
      cursor: pointer;
      white-space: nowrap;
    }
    .minor button { background: rgba(0,0,0,.08); border-color: rgba(0,0,0,.4); }
    button:hover { background: rgba(255,255,255,.3); }
    .minor button:hover { background: rgba(0,0,0,.16); }
    button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .minor button:focus-visible { outline-color: #000; }
    .source { font-size: 11px; opacity: .8; margin: 6px 0 0; text-align: right; max-width: 1200px; margin-left: auto; margin-right: auto; }
    /* Entrén spelas bara vid första renderingen (klassen 'enter'), så att
       "Visa mer" inte startar om animationen varje gång innehållet byggs om. */
    @media (prefers-reduced-motion: no-preference) {
      .bar.enter {
        transform-origin: top center;
        animation: vma-pop .42s cubic-bezier(.22, 1.2, .36, 1) both;
      }
      @keyframes vma-pop {
        0%   { opacity: 0; transform: translateY(-14px) scale(.90); }
        55%  { opacity: 1; }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
    }
    @media (max-width: 600px) {
      .bar { top: 6px; left: 6px; right: 6px; border-radius: 12px; }
      .row { flex-wrap: wrap; }
      .actions { width: 100%; justify-content: flex-end; }
    }
  `;

  let host = null;
  let shadow = null;
  let expanded = false;
  let announced = false; // role="alert" only on first render, to avoid re-announcing on expand

  function ensureHost() {
    if (host && host.isConnected && shadow) return;
    // Stale element from a previous instance (e.g. after an extension reload)
    document.getElementById(HOST_ID)?.remove();
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('lang', 'sv');
    shadow = host.attachShadow({ mode: 'closed' });
    (document.documentElement || document.body).appendChild(host);
  }

  function removeBanner() {
    if (host) {
      host.remove();
    }
    host = null;
    shadow = null;
    announced = false;
  }

  function render(alerts, lang) {
    ensureHost();
    const t = STRINGS[lang] || STRINGS.sv;
    host.setAttribute('lang', lang === 'en' ? 'en' : 'sv');

    // Rebuild the shadow content (small DOM, cheap)
    shadow.replaceChildren();

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    const firstRender = !announced;
    const bar = document.createElement('div');
    bar.className = 'bar ' + severityClass(alerts) + (firstRender ? ' enter' : '');
    if (firstRender) {
      bar.setAttribute('role', 'alert');
      bar.setAttribute('aria-live', 'assertive');
      bar.setAttribute('aria-atomic', 'true');
      announced = true;
    } else {
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', t.label);
    }

    const row = document.createElement('div');
    row.className = 'row';

    const body = document.createElement('div');
    body.className = 'body';

    alerts.forEach(alert => {
      const info = findBestMatchingInfo(alert.info, lang);
      const wrap = document.createElement('div');
      wrap.className = 'alert';
      wrap.setAttribute('lang', info.language === 'en-US' ? 'en' : 'sv');

      const titleRow = document.createElement('p');
      titleRow.className = 'title';
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = isTestAlert(alert) ? t.test : t.label;
      titleRow.appendChild(tag);
      titleRow.appendChild(document.createTextNode(' ' + (info.event || 'Viktigt Meddelande till Allmänheten')));
      wrap.appendChild(titleRow);

      const desc = document.createElement('p');
      desc.className = 'desc' + (expanded ? '' : ' clamped');
      desc.textContent = info.description || '';
      wrap.appendChild(desc);

      const meta = document.createElement('p');
      meta.className = 'meta';
      const areas = (info.area || []).map(a => a.areaDesc).filter(Boolean).join(', ');
      const sent = alert.sent ? new Date(alert.sent) : null;
      const sentText = sent && !isNaN(sent) ? sent.toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE') : '';
      meta.textContent = `${t.affected}: ${areas || t.wholeCountry}` + (sentText ? ` · ${sentText}` : '');
      wrap.appendChild(meta);

      body.appendChild(wrap);
    });

    if (alerts.length > 1) {
      const count = document.createElement('p');
      count.className = 'meta';
      count.textContent = t.count(alerts.length);
      body.appendChild(count);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.textContent = expanded ? t.less : t.more;
    moreBtn.setAttribute('aria-expanded', String(expanded));
    moreBtn.addEventListener('click', () => {
      expanded = !expanded;
      refresh();
    });

    const acknowledgeBtn = document.createElement('button');
    acknowledgeBtn.type = 'button';
    acknowledgeBtn.textContent = t.acknowledge;
    acknowledgeBtn.title = t.acknowledgeTitle;
    acknowledgeBtn.setAttribute('aria-label', t.acknowledge + '. ' + t.acknowledgeTitle);
    acknowledgeBtn.addEventListener('click', () => {
      const identifiers = alerts.map(a => a.identifier).filter(Boolean);
      safeSendMessage({ action: 'acknowledgeAlerts', identifiers });
      removeBanner(); // Hide immediately; the silent-mode change propagates to other tabs
    });

    actions.appendChild(moreBtn);
    actions.appendChild(acknowledgeBtn);

    row.appendChild(body);
    row.appendChild(actions);
    bar.appendChild(row);

    const source = document.createElement('p');
    source.className = 'source';
    source.textContent = t.source;
    bar.appendChild(source);

    shadow.appendChild(bar);
  }

  function safeSendMessage(message) {
    try {
      const p = chrome.runtime.sendMessage(message);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // Extension was reloaded/uninstalled; nothing to do.
    }
  }

  async function refresh() {
    try {
      const [{ activeAlerts = [], silentMode = false, bannerEnabled = false },
             { preferredLanguage }] = await Promise.all([
        chrome.storage.local.get(['activeAlerts', 'silentMode', 'bannerEnabled']),
        chrome.storage.sync.get(['preferredLanguage'])
      ]);

      if (!bannerEnabled || silentMode) {
        removeBanner();
        return;
      }

      const visible = activeAlerts.filter(a => a && a.msgType === 'Alert');

      if (visible.length === 0) {
        removeBanner();
        return;
      }

      render(visible, resolveLanguage(preferredLanguage));
    } catch {
      // Extension context invalidated (extension updated/reloaded). Clean up.
      removeBanner();
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' &&
          ('activeAlerts' in changes || 'silentMode' in changes ||
           'bannerEnabled' in changes)) {
        refresh();
      } else if (area === 'sync' && 'preferredLanguage' in changes) {
        refresh();
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.action === 'vmaBannerRemove') {
        // Keep this instance alive; it re-renders via storage.onChanged if re-enabled.
        removeBanner();
      }
    });
  } catch {
    // Not running as an extension content script; ignore.
  }

  refresh();
})();
