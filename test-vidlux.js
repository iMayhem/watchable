const crypto = require('crypto');
const https = require('https');
const http = require('http');

const API_BASE = 'https://vidlux.xyz';
const DECRYPTION_KEY = 'vidlux-stream-encryption-2026-secure-key';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Referer': 'https://vidlux.xyz/',
  'Origin': 'https://vidlux.xyz',
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: HEADERS, timeout: 15000 }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        resolve(d);
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    console.log('Fetching embed...');
    const html = await fetchUrl(API_BASE + '/embed/tv/1399/1/1');
    console.log('HTML length:', html.length);
    const m = html.match(/requestToken[^:]*:[^"']*["']([^"']+)/);
    console.log('Token found:', m ? m[1].substring(0, 20) + '...' : 'NO');
    if (!m) return;

    console.log('Fetching extract...');
    const body = await fetchUrl(API_BASE + '/api/extract/rocket?id=1399&type=tv&season=1&episode=1&_t=' + m[1]);
    console.log('Response length:', body.length);
    const d = JSON.parse(body);
    console.log('Keys:', Object.keys(d));
    console.log('encrypted:', d.encrypted);
    console.log('has data:', !!d.data);

    if (d.encrypted && d.data) {
      const buf = Buffer.from(d.data, 'base64');
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(buf.length - 16);
      const ct = buf.subarray(12, buf.length - 16);
      const key = crypto.createHash('sha256').update(DECRYPTION_KEY).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const dec = JSON.parse(decipher.update(ct) + decipher.final('utf8'));
      console.log('Decrypted type:', Array.isArray(dec) ? 'array' : typeof dec);
      const items = Array.isArray(dec) ? dec : (dec.streams || []);
      console.log('Items:', items.length);
      items.forEach((s, i) => console.log(i + ':', s.quality, s.file && s.file.substring(0, 60)));
    }
  } catch(e) {
    console.log('Error:', e.message);
    console.log(e.stack ? e.stack.substring(0, 300) : '');
  }
})();
