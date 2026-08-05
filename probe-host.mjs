import puppeteer from 'puppeteer';
const BASE = 'https://movieace.sujeetunbeatable.workers.dev';
const browser = await puppeteer.launch({ headless: 'shell' });
const p = await browser.newPage();
await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36');
await p.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
p.on('console', m => { const t=m.text(); if(/Party|room|frame|embed|host/i.test(t)) console.log('[cs]', t.slice(0,200)); });
await p.goto(`${BASE}/party?media=572802&title=Inception%20PartyTest`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r=>setTimeout(r,15000));
const info = await p.evaluate(() => ({
  url: location.href,
  roomViewActive: document.getElementById('room-view')?.classList.contains('active'),
  lobbyActive: document.getElementById('lobby-view')?.classList.contains('active'),
  iframe: !!document.getElementById('video-player-iframe'),
  iframeSrc: document.getElementById('video-player-iframe')?.getAttribute('src'),
  activeServer: document.getElementById('active-server-name')?.textContent,
  bodyClasses: document.body.className,
  playerStage: document.getElementById('player-stage')?.className
}));
console.log('STATE', JSON.stringify(info, null, 2));
await browser.close();
