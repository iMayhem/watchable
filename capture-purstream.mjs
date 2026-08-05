import puppeteer from 'puppeteer';

const WATCH_URL = 'https://purstream.store/watch/eyJ0eXBlIjoibW92aWUiLCJpZCI6MTY5NjR9';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

const requests = [];
page.on('request', request => {
  const url = request.url();
  if (url.includes('purstream.store') || url.includes('.m3u8') || url.includes('.ts')) {
    requests.push({
      url,
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
    });
  }
});

const responses = [];
page.on('response', async response => {
  const url = response.url();
  if (url.includes('purstream.store')) {
    try {
      const json = await response.json().catch(() => null);
      responses.push({
        url,
        status: response.status(),
        contentType: response.headers()['content-type'],
        body: json,
      });
    } catch {}
  }
});

console.log('Navigating to watch URL...');
await page.goto(WATCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log('Goto warning:', e.message));
console.log('Page loaded, waiting for streams...');
await new Promise(r => setTimeout(r, 8000));

console.log('\n=== REQUESTS ===');
for (const r of requests) {
  console.log(r.method, r.url);
  if (r.headers.authorization) console.log('  Auth:', r.headers.authorization.substring(0, 50));
  if (r.headers.cookie) console.log('  Cookie:', r.headers.cookie.substring(0, 80));
}
console.log('\n=== RESPONSES WITH JSON ===');
for (const r of responses) {
  console.log(r.status, r.url);
  if (r.body) console.log('  Body:', JSON.stringify(r.body).substring(0, 500));
}

await browser.close();
