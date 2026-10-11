// High-speed CDN mirror for Streamly APK
// Redirects to high-speed dedicated mirror to avoid GitHub releases bandwidth throttling

const MIRROR_APK_URL = 'https://streamaggregator.in/download';

export const onRequestGet: PagesFunction = async () => {
    return Response.redirect(MIRROR_APK_URL, 302);
};
