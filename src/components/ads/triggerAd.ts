const AD_DOMAIN = 'dc9xwpjprguup.cloudfront.net';

export function triggerAd() {
    const s = document.createElement('script');
    s.setAttribute('data-cfasync', 'false');
    s.src = `https://${AD_DOMAIN}/?pwxcd=1436467`;
    document.head.appendChild(s);
    setTimeout(() => {
        const s2 = document.createElement('script');
        s2.setAttribute('data-cfasync', 'false');
        s2.src = `https://${AD_DOMAIN}/?pwxcd=1448933`;
        document.head.appendChild(s2);
    }, 100);
}
