const MOBILE_UA =
  /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|iPad|Tablet/i;

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

export async function onRequest(context: {
  request: Request;
  next: () => Response | Promise<Response>;
}) {
  const url = new URL(context.request.url);
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('m.')) {
    return context.next();
  }

  if (shouldSkipRedirect(url.pathname)) {
    return context.next();
  }

  if (url.searchParams.has('desktop')) {
    return context.next();
  }

  if (!isMobileRequest(context.request)) {
    return context.next();
  }

  const targetPath = mapPathForMobile(url.pathname);
  const target = new URL(`https://m.${host}${targetPath}`);
  target.search = url.search;
  target.hash = url.hash;

  return Response.redirect(target.toString(), 302);
}