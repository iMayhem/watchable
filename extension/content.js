(function initMoovieStreamBoost() {
  const API = {
    active: true,
    version: '1.2.1',
    mode: 'direct-cdn',
  };

  /** Page-world bridge is injected once — re-injecting on every DOM mutation caused hangs. */
  let pageBridgeInjected = false;

  function injectPageBridge() {
    if (pageBridgeInjected) return;
    const payload = JSON.stringify(API);
    const script = document.createElement('script');
    script.textContent = `(function(){
      var api = ${payload};
      window.__MOOVIE_STREAM_EXT__ = api;
      window.dispatchEvent(new CustomEvent('moovie-stream-ext-ready', { detail: api }));
    })();`;
    const parent = document.documentElement || document.head || document.body;
    if (!parent) return;
    parent.appendChild(script);
    script.remove();
    pageBridgeInjected = true;
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
    if (!pageBridgeInjected) injectPageBridge();
    window.postMessage(
      {
        type: 'MOOVIE_EXT_PONG',
        detail: API,
      },
      '*'
    );
  });
})();