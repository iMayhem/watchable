import { mobileRedirectUrl } from './deviceRouting';

export async function onRequest(context) {
  const { request, next } = context;

  if (request.method !== 'GET') {
    return next();
  }

  const deviceRedirect = mobileRedirectUrl(request);
  if (deviceRedirect) {
    return Response.redirect(deviceRedirect, 302);
  }

  return next();
}