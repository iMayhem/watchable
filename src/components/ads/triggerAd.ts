const AD_DOMAIN = '//fa.forsungxylols.com/rn57m0jviM5eK/147918';

export function triggerAd() {
    const s = document.createElement('script');
    s.setAttribute('data-cfasync', 'false');
    s.async = true;
    s.type = 'text/javascript';
    s.src = AD_DOMAIN;
    document.head.appendChild(s);
}
