const puppeteer = require('puppeteer')
async function main() {
    const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({ 'Referer': 'https://www.rivestream.app/' })
    const reqs = []
    page.on('request', (r) => { if (['xhr', 'fetch', 'media', 'script', 'document'].includes(r.resourceType())) reqs.push(`${r.resourceType()}:${r.url().slice(0, 100)}`) })
    await page.goto('https://q8y5z.com/no6w/m0m3z9o1dbx4', { waitUntil: 'domcontentloaded', timeout: 35000 }).catch((e) => console.log('goto err', String(e).slice(0, 80)))
    await new Promise((r) => setTimeout(r, 10000))
    const st = await page.evaluate(() => ({
        vids: [...document.querySelectorAll('video')].map((v) => (v.currentSrc || v.src || '').slice(0, 90)),
        embed: document.body.classList.contains('video-embed-mode'),
        rootTxt: (document.getElementById('root')?.innerText || '').slice(0, 100)
    }))
    console.log('STATE:', JSON.stringify(st))
    console.log('REQS:'); reqs.filter(r => !r.includes('cdn-cgi')).slice(0, 15).forEach(r => console.log('  ', r))
    await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
