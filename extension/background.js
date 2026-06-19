const RULESET_ID = 'cdn_headers';

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [RULESET_ID],
    });
  } catch (err) {
    console.warn('[Moovie Stream Boost] ruleset enable failed', err);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'MOOVIE_EXT_PING') {
    sendResponse({
      active: true,
      version: chrome.runtime.getManifest().version,
      mode: 'direct-cdn',
    });
    return true;
  }
});