const puppeteer = require('puppeteer')

async function probe(url, label) {
    const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    const page = await browser.newPage()
    const reqs = []
    page.on('request', (r) => { if (r.resourceType() === 'xhr' || r.resourceType() === 'fetch' || r.resourceType() === 'media') reqs.push(r.url().slice(0, 110)) })
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 })
    } catch (e) { console.log(label, 'goto err:', String(e).slice(0, 100)) }
    await new Promise((r) => setTimeout(r, 9000))
    const state = await page.evaluate(() => {
        const vids = [...document.querySelectorAll('video')].map((v) => ({ src: (v.currentSrc || v.src || '').slice(0, 100), w: v.videoWidth, h: v.videoHeight }))
        const path = location.pathname
        return { path, vids, hasEmbedClass: document.body?.classList.contains('video-embed-mode') || document.documentElement?.classList.contains('video-embed-mode'), text: document.body?.innerText?.slice(0, 120) || '' }
    })
    console.log(label, JSON.stringify(state))
    console.log('  reqs:', reqs.length ? reqs.slice(0, 8) : 'none')
    await browser.close()
}

;(async () => {
    await probe('https://q8y5z.com/no6w/m0m3z9o1dbx4', 'no6w-code  ')
    await probe('https://q8y5z.com/movie/299534', 'movie-tmdb ')
})()