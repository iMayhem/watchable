import { ref } from 'vue'

const BTC_ADDR = 'bc1qkk0yyu8efu2gep5y59ev7s4j0wxnpxsfh4ympk'
const LTC_ADDR = 'ltc1qpnurrqnv466wa4uh6urh0ul5n4wu0rf8k5l25z'
const USDT_ADDR = 'TKfaywHdffM1iYdiSP3xFPajxgXwq2jmDG'
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

const btcUsd = ref(0)
const ltcUsd = ref(0)
const totalUsd = ref(0)
const loading = ref(false)

async function fetchBtcBalance(): Promise<number> {
    try {
        const res = await fetch(`https://api.blockchair.com/bitcoin/address/${BTC_ADDR}?limit=0,1`)
        const json = await res.json()
        const sat = json?.data?.[BTC_ADDR]?.balance ?? 0
        return sat / 1e8
    } catch { return 0 }
}

async function fetchLtcBalance(): Promise<number> {
    try {
        const res = await fetch(`https://api.blockchair.com/litecoin/address/${LTC_ADDR}?limit=0,1`)
        const json = await res.json()
        const lit = json?.data?.[LTC_ADDR]?.balance ?? 0
        return lit / 1e8
    } catch { return 0 }
}

async function fetchUsdtBalance(): Promise<number> {
    try {
        const res = await fetch(`https://api.trongrid.io/v1/accounts/${USDT_ADDR}?only_confirmed=true`)
        const json = await res.json()
        const tokens = json?.data?.[0]?.trc20 ?? []
        for (const t of tokens) {
            if (t[USDT_CONTRACT]) {
                return Number(t[USDT_CONTRACT]) / 1e6
            }
        }
        return 0
    } catch { return 0 }
}

async function fetchPrices(): Promise<{ btc: number; ltc: number }> {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,litecoin,tether&vs_currencies=usd')
        const json = await res.json()
        return {
            btc: json?.bitcoin?.usd ?? 0,
            ltc: json?.litecoin?.usd ?? 0
        }
    } catch { return { btc: 0, ltc: 0 } }
}

export function useCryptoBalance() {
    async function refreshBalances() {
        loading.value = true
        const [btcBal, ltcBal, usdtBal, prices] = await Promise.all([
            fetchBtcBalance(),
            fetchLtcBalance(),
            fetchUsdtBalance(),
            fetchPrices()
        ])
        btcUsd.value = btcBal * prices.btc
        ltcUsd.value = ltcBal * prices.ltc
        totalUsd.value = btcUsd.value + ltcUsd.value + usdtBal
        loading.value = false
    }

    return {
        btcUsd,
        ltcUsd,
        totalUsd,
        loading,
        refreshBalances
    }
}
