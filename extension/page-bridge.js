/**
 * Runs in the page (MAIN) world so moovie.fun can detect the extension.
 * Isolated content scripts cannot reliably dispatch events the Vue app hears.
 */
(function initMooviePageBridge() {
  const DEFAULT_VERSION = '1.5.2';

  const API = {
    active: true,
    version: DEFAULT_VERSION,
    mode: 'direct-cdn',
  };

  function markDom() {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute('data-moovie-ext', 'active');
    root.setAttribute('data-moovie-ext-version', API.version);
  }

  function signalReady() {
    markDom();
    window.dispatchEvent(
      new CustomEvent('moovie-stream-ext-ready', { detail: API })
    );
  }

  function signalPong() {
    markDom();
    window.dispatchEvent(
      new CustomEvent('moovie-stream-ext-pong', { detail: API })
    );
  }

  signalReady();
  window.addEventListener('moovie-ext-ping', signalPong);
})();