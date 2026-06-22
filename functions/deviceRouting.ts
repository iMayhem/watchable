const PHONE_UA = /iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;
const TABLET_UA = /iPad|Tablet|tablet|PlayBook|Silk/i;
const LARGE_TABLET_MIN_SHORT = 768;
const LARGE_TABLET_MIN_LONG = 1024;

const BYPASS_PREFIXES = ['/api/', '/party', '/favicon', '/player.html'];

export function isBypassPath(pathname: string): boolean {
  if (BYPASS_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
  if (/\.[a-z0-9]+$/i.test(pathname)) return true;
  return false;
}

export function normalizePath(pathname: string): string {
  if (/^\/nf(\/|$)/.test(pathname) || /^\/stream\/nf(\/|$)/.test(pathname) || /^\/embed\/nf(\/|$)/.test(pathname)) {
    return '/';
  }
  return pathname;
}

export function isPhoneUserAgent(ua: string): boolean {
  if (PHONE_UA.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/Mobile/i.test(ua) && !TABLET_UA.test(ua)) return true;
  return false;
}

export function isTabletUserAgent(ua: string): boolean {
  if (TABLET_UA.test(ua)) return true;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return true;
  return false;
}

/** Client Hints when the browser sends them (Chrome, some Android). */
export function viewportWidthFromRequest(request: Request): number {
  const raw =
    request.headers.get('Sec-CH-Viewport-Width') ||
    request.headers.get('Viewport-Width') ||
    '';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isMobileClientHint(request: Request): boolean | null {
  const hint = request.headers.get('Sec-CH-UA-Mobile');
  if (hint === '?1') return true;
  if (hint === '?0') return false;
  return null;
}

/**
 * Large tablets (≥1024×768) may use the desktop site.
 * Without viewport hints we cannot size iPadOS-on-Macintosh; phones always win via isPhoneUserAgent.
 */
export function isLargeTabletViewport(width: number, height = 0): boolean {
  if (width > 0 && width < LARGE_TABLET_MIN_SHORT) return false;
  if (height > 0 && height < LARGE_TABLET_MIN_SHORT) return false;
  const short = height > 0 ? Math.min(width, height) : width;
  const long = height > 0 ? Math.max(width, height) : width;
  if (height > 0) {
    return short >= LARGE_TABLET_MIN_SHORT && long >= LARGE_TABLET_MIN_LONG;
  }
  return width >= LARGE_TABLET_MIN_LONG;
}

export function shouldServeMobileSite(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.has('desktop')) return false;
  if (url.searchParams.has('mobile')) return true;

  const ua = request.headers.get('User-Agent') || '';

  if (isPhoneUserAgent(ua)) return true;

  const mobileHint = isMobileClientHint(request);
  if (mobileHint === true) return true;

  const vpWidth = viewportWidthFromRequest(request);
  if (mobileHint === false && vpWidth > 0 && vpWidth < LARGE_TABLET_MIN_SHORT) {
    return true;
  }

  if (isTabletUserAgent(ua)) {
    if (vpWidth > 0) {
      return !isLargeTabletViewport(vpWidth);
    }
    return true;
  }

  // Touch laptops are not detectable server-side; client script handles narrow viewports.
  return false;
}

export function mobileRedirectUrl(request: Request): string | null {
  const url = new URL(request.url);
  const host = url.hostname;

  if (host === 'localhost' || host === '127.0.0.1') return null;
  if (isBypassPath(url.pathname)) return null;
  if (request.method !== 'GET') return null;

  const path = normalizePath(url.pathname);
  const target = `${path}${url.search}${url.hash}`;

  const isMobileHost = host.startsWith('m.');
  const wantsMobile = shouldServeMobileSite(request);

  if (!isMobileHost && wantsMobile) {
    const apex = host.replace(/^www\./, '');
    return `https://m.${apex}${target}`;
  }

  if (isMobileHost && !wantsMobile) {
    const apex = host.replace(/^www\./, '').replace(/^m\./, '');
    return `https://${apex}${target}`;
  }

  if (isMobileHost && path !== url.pathname) {
    return `https://${host}${target}`;
  }

  return null;
}