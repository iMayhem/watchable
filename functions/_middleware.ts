const MOBILE_UA =
  /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|iPad|Tablet/i;

const BOT_UA =
  /bot|crawler|spider|robot|crawling|lighthouse|headless|phantom|selenium|puppeteer|playwright|bytespider|petalbot|gptbot|claudebot|anthropic|semrush|ahrefs|mj12bot|dotbot|yandexbot|bingbot|slurp|duckduckbot|baiduspider|scrapy|curl|wget|python|requests|httpie|go-http-client|okhttp|java|ruby|php|perl|libwww|wwww|nutch|archive/i;

const DESKTOP_SITE_APEX = new Set(['moovie.fun', 'localhost', '127.0.0.1']);

function isBotRequest(request: Request): boolean {
  const ua = (request.headers.get('User-Agent') || '').trim().toLowerCase();
  if (!ua) return true;
  if (BOT_UA.test(ua)) return true;
  return false;
}

function normalizeApexHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./i, '');
}

function isDesktopSiteHost(hostname: string): boolean {
  const apex = normalizeApexHost(hostname);
  return DESKTOP_SITE_APEX.has(apex);
}

function isMobileSiteHost(hostname: string): boolean {
  return normalizeApexHost(hostname).startsWith('m.');
}

function isMobileRequest(request: Request): boolean {
  const ua = request.headers.get('User-Agent') || '';
  if (MOBILE_UA.test(ua)) return true;

  const chMobile = request.headers.get('Sec-CH-UA-Mobile');
  if (chMobile === '?1') return true;

  return false;
}

function shouldSkipRedirect(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/party')) return true;
  if (/\.[a-z0-9]+$/i.test(pathname)) return true;
  return false;
}

function mapPathForMobile(pathname: string): string {
  if (
    /^\/nf(\/|$)/.test(pathname) ||
    /^\/stream\/nf(\/|$)/.test(pathname) ||
    /^\/embed\/nf(\/|$)/.test(pathname)
  ) {
    return '/';
  }
  return pathname;
}

function wantsDesktopSite(url: URL): boolean {
  if (url.searchParams.has('desktop')) return true;
  return /\bdesktop=1\b/i.test(url.search) || /desktop/i.test(url.search);
}

export async function onRequest(context: {
  request: Request;
  next: () => Response | Promise<Response>;
}) {
  if (isBotRequest(context.request)) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(context.request.url);
  const hostname = url.hostname;

  if (!isDesktopSiteHost(hostname) || isMobileSiteHost(hostname)) {
    return context.next();
  }

  if (shouldSkipRedirect(url.pathname)) {
    return context.next();
  }

  if (wantsDesktopSite(url)) {
    return context.next();
  }

  if (!isMobileRequest(context.request)) {
    return context.next();
  }

  const apex = normalizeApexHost(hostname);
  const targetPath = mapPathForMobile(url.pathname);
  const target = new URL(`https://m.${apex}${targetPath}`);
  target.search = url.search;
  target.hash = url.hash;

  return Response.redirect(target.toString(), 302);
}