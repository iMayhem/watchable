(function initMoovieStreamBoost() {
  const API = {
    active: true,
    version: '1.2.0',
    mode: 'direct-cdn',
  };

  /** Inject into the page's JS world — isolated content-script `window` is invisible to Vue. */
  function injectPageBridge() {
    const payload = JSON.stringify(API);
    const script = document.createElement('script');
    script.setAttribute('data-moovie-stream-boost', '1');
    script.textContent = `(function(){
      var api = ${payload};
      window.__MOOVIE_STREAM_EXT__ = api;
      window.dispatchEvent(new CustomEvent('moovie-stream-ext-ready', { detail: api }));
    })();`;
    const parent = document.documentElement || document.head || document.body;
    if (!parent) return;
    parent.appendChild(script);
    script.remove();
  }

  function announceIsolated() {
    window.__MOOVIE_STREAM_EXT__ = API;
    window.dispatchEvent(new CustomEvent('moovie-stream-ext-ready', { detail: API }));
  }

  function announce() {
    injectPageBridge();
    announceIsolated();
  }

  announce();

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'MOOVIE_EXT_PING') return;
    injectPageBridge();
    window.postMessage(
      {
        type: 'MOOVIE_EXT_PONG',
        detail: API,
      },
      '*'
    );
  });

  const observer = new MutationObserver(() => {
    if (document.documentElement && !document.querySelector('script[data-moovie-stream-boost]')) {
      injectPageBridge();
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: false });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      announce();
      observer.observe(document.documentElement, { childList: true, subtree: false });
    });
  }
})();