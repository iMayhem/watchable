import { ref } from 'vue'
import { getSyncClient } from '../lib/syncClient'

export interface Poll {
    id: number
    question: string
    options: string[]
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface PollResult {
    option: string
    count: number
    percentage: number
}

export interface PollWithResults extends Poll {
    results: PollResult[]
    totalVotes: number
}

const activePoll = ref<Poll | null>(null)
const pollResults = ref<PollResult[]>([])
const totalVotes = ref(0)
const loading = ref(false)
const voting = ref(false)
const allPolls = ref<PollWithResults[]>([])

const POLL_VOTED_PREFIX = 'poll_voted_'
const POLL_DISMISSED_PREFIX = 'poll_dismissed_'

export function usePolls() {
    async function fetchActivePoll() {
        loading.value = true
        try {
            const sync = await getSyncClient()
            const { data } = await sync
                .from('polls')
                .select('id, question, options, is_active, created_at')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            activePoll.value = data ? {
                ...data,
                options: typeof data.options === 'string' ? JSON.parse(data.options) : data.options
            } : null

            if (activePoll.value) {
                await fetchPollResults(activePoll.value.id)
            } else {
                pollResults.value = []
                totalVotes.value = 0
            }
        } catch (e) {
            console.error('Failed to fetch poll:', e)
            activePoll.value = null
        } finally {
            loading.value = false
        }
    }

    async function fetchPollResults(pollId: number) {
        try {
            const sync = await getSyncClient()
            const poll = activePoll.value
            if (!poll) return

            const counts = await Promise.all(
                poll.options.map(async (_, idx) => {
                    const { count } = await sync
                        .from('poll_votes')
                        .select('*', { count: 'exact', head: true })
                        .eq('poll_id', pollId)
                        .eq('selected_option', idx)
                    return count || 0
                })
            )

            const total = counts.reduce((a, b) => a + b, 0)
            totalVotes.value = total

            pollResults.value = poll.options.map((opt, i) => ({
                option: opt,
                count: counts[i],
                percentage: total > 0 ? Math.round((counts[i] / total) * 100) : 0
            }))
        } catch (e) {
            console.error('Failed to fetch poll results:', e)
        }
    }

    async function fetchAllPolls() {
        try {
            const sync = await getSyncClient()
            const { data } = await sync
                .from('polls')
                .select('id, question, options, is_active, created_at')
                .order('created_at', { ascending: false })

            const polls: PollWithResults[] = await Promise.all(
                (data || []).map(async (row: any) => {
                    const poll: Poll = {
                        ...row,
                        options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options
                    }

                    const counts = await Promise.all(
                        poll.options.map(async (_, idx) => {
                            const { count } = await sync
                                .from('poll_votes')
                                .select('*', { count: 'exact', head: true })
                                .eq('poll_id', poll.id)
                                .eq('selected_option', idx)
                            return count || 0
                        })
                    )

                    const total = counts.reduce((a, b) => a + b, 0)

                    return {
                        ...poll,
                        totalVotes: total,
                        results: poll.options.map((opt, i) => ({
                            option: opt,
                            count: counts[i],
                            percentage: total > 0 ? Math.round((counts[i] / total) * 100) : 0
                        }))
                    }
                })
            )

            allPolls.value = polls
        } catch (e) {
            console.error('Failed to fetch all polls:', e)
            allPolls.value = []
        }
    }

    async function vote(pollId: number, selectedOption: number) {
        const storageKey = POLL_VOTED_PREFIX + pollId
        if (localStorage.getItem(storageKey)) return false
        voting.value = true
        try {
            const sync = await getSyncClient()
            await sync.from('poll_votes').insert({
                poll_id: pollId,
                selected_option: selectedOption,
                voted_at: new Date().toISOString()
            })
            localStorage.setItem(storageKey, 'true')
            await fetchPollResults(pollId)
            return true
        } catch (e) {
            console.error('Failed to vote:', e)
            return false
        } finally {
            voting.value = false
        }
    }

    function hasVoted(pollId: number): boolean {
        return localStorage.getItem(POLL_VOTED_PREFIX + pollId) === 'true'
    }

    function hasDismissed(pollId: number): boolean {
        const raw = localStorage.getItem(POLL_DISMISSED_PREFIX + pollId)
        if (!raw) return false
        const ts = Number(raw)
        if (!Number.isFinite(ts)) return false
        return Date.now() - ts < 24 * 60 * 60 * 1000
    }

    function dismissPoll(pollId: number) {
        localStorage.setItem(POLL_DISMISSED_PREFIX + pollId, String(Date.now()))
    }

    function clearPollStorage(pollId: number) {
        localStorage.removeItem(POLL_VOTED_PREFIX + pollId)
        localStorage.removeItem(POLL_DISMISSED_PREFIX + pollId)
    }

    return {
        activePoll,
        pollResults,
        totalVotes,
        loading,
        voting,
        allPolls,
        fetchActivePoll,
        fetchPollResults,
        fetchAllPolls,
        vote,
        hasVoted,
        hasDismissed,
        dismissPoll,
        clearPollStorage
    }
}
