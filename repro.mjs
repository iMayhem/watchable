import puppeteer from 'puppeteer';
import fs from 'node:fs';
const out = [];
const browser = await puppeteer.launch({ headless: 'shell' });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');
await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
for (const path of [
  'https://api2.imdb4.shop/api/movie/122801?lang=en',
  'https://api2.imdb4.shop/api/movie/122801/info',
  'https://api2.imdb4.shop/api/movies?id=122801'
]) {
  try {
    const res = await page.goto(path, { waitUntil: 'networkidle0', timeout: 45000 });
    const body = await res.text();
    out.push(path + ' -> ' + res.status() + ' ' + (body.startsWith('{') ? 'JSON' : body.slice(0,60).replace(/\s+/g,' ')));
  } catch(e) { out.push(path + ' -> ERR ' + e.message.slice(0,60)); }
}
await browser.close();
fs.writeFileSync('/tmp/opencode/variants-out.log', out.join('\n'));
console.log('done');
