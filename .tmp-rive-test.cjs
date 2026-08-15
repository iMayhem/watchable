const puppeteer = require('puppeteer')

async function main() {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium',
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    const xhrs = []
    page.on('request', (r) => {
        const t = r.resourceType()
        if (t === 'xhr' || t === 'fetch' || t === 'script' || t === 'document') {
            xhrs.push(`${r.method()} ${r.url().slice(0, 160)}`)
        }
    })
    page.on('console', (m) => { if (/api|embed|server|error/i.test(m.text())) console.log('CONSOLE:', m.text().slice(0, 150)) })
    await page.goto('https://www.rivestream.app/watch?type=movie&id=1504358', { waitUntil: 'domcontentloaded', timeout: 50000 })
    await new Promise((r) => setTimeout(r, 10000))
    const state = await page.evaluate(() => {
        const iframes = [...document.querySelectorAll('iframe')].map((f) => f.src).filter(Boolean)
        const btns = [...document.querySelectorAll('button, [class*="server"], [class*="Server"], [role="button"]')]
            .map((b) => (b.textContent || '').trim().slice(0, 40))
            .filter(Boolean)
            .slice(0, 20)
        return { iframes, btns }
    })
    console.log('IFRAMES:', JSON.stringify(state.iframes, null, 1))
    console.log('BUTTONS:', JSON.stringify(state.btns, null, 1))
    console.log('REQUESTS:')
    for (const x of xhrs) console.log('  ', x)
    await browser.close()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })