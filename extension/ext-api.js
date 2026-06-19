/**
 * Cross-browser WebExtension API shim.
 * Works in Chrome, Edge, Opera, Brave, Vivaldi, Firefox, and other MV3 browsers.
 */
(function initMoovieExtApi() {
  const raw = globalThis.browser ?? globalThis.chrome;
  if (!raw?.runtime) return;

  const DEFAULT_VERSION = '1.5.2';

  function getVersion() {
    try {
      return raw.runtime.getManifest().version || DEFAULT_VERSION;
    } catch {
      return DEFAULT_VERSION;
    }
  }

  function onInstalled(handler) {
    raw.runtime.onInstalled.addListener(handler);
  }

  function onMessage(handler) {
    raw.runtime.onMessage.addListener(handler);
  }

  function pingResponse() {
    return {
      active: true,
      version: getVersion(),
      mode: 'direct-cdn',
    };
  }

  async function enableCdnRuleset(rulesetId) {
    const dnr = raw.declarativeNetRequest;
    if (!dnr?.updateEnabledRulesets) return;

    try {
      await dnr.updateEnabledRulesets({ enableRulesetIds: [rulesetId] });
    } catch (err) {
      console.warn('[Moovie] CDN ruleset enable failed', err);
    }
  }

  globalThis.moovieExt = {
    getVersion,
    onInstalled,
    onMessage,
    pingResponse,
    enableCdnRuleset,
  };
})();