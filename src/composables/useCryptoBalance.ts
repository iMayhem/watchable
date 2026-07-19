import { ref } from 'vue'

const btcUsd = ref(0)
const ltcUsd = ref(0)
const totalUsd = ref(0)
const loading = ref(false)

async function fetchBtcBalance(): Promise<number> {
    return 0
}

async function fetchLtcBalance(): Promise<number> {
    return 0
}

async function fetchUsdtBalance(): Promise<number> {
    return 0
}

async function fetchPrices(): Promise<{ btc: number; ltc: number }> {
    return { btc: 0, ltc: 0 }
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
