const AD_DOMAIN = '//dc9xwpjprguup.cloudfront.net/?pwxcd=1436467';

export function triggerAd() {
    const s = document.createElement('script');
    s.setAttribute('data-cfasync', 'false');
    s.async = true;
    s.type = 'text/javascript';
    s.src = AD_DOMAIN;
    document.head.appendChild(s);
}
