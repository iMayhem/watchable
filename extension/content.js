(function initMoovieStreamBoost() {
  const API = {
    active: true,
    version: '1.0.0',
    mode: 'direct-cdn',
  };

  function announce() {
    window.__MOOVIE_STREAM_EXT__ = API;
    window.dispatchEvent(new CustomEvent('moovie-stream-ext-ready', { detail: API }));
  }

  announce();

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'MOOVIE_EXT_PING') return;
    window.postMessage(
      {
        type: 'MOOVIE_EXT_PONG',
        detail: API,
      },
      '*'
    );
  });

  const observer = new MutationObserver(() => {
    if (!window.__MOOVIE_STREAM_EXT__) announce();
  });
  observer.observe(document.documentElement, { childList: true, subtree: false });
})();