import { ref } from 'vue'
import { getSupabaseClient } from '../lib/supabase'

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
            const supabase = await getSupabaseClient()
            const { data } = await supabase
                .from('polls')
                .select('id, question, options, is_active, created_at')
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
            const supabase = await getSupabaseClient()
            const { data: votes } = await supabase
                .from('poll_votes')
                .select('selected_option')
                .eq('poll_id', pollId)

            const poll = activePoll.value
            if (!poll) return

            totalVotes.value = votes?.length || 0
            const counts = new Array(poll.options.length).fill(0)
            votes?.forEach((v: any) => {
                if (v.selected_option >= 0 && v.selected_option < poll.options.length) {
                    counts[v.selected_option]++
                }
            })

            pollResults.value = poll.options.map((opt, i) => ({
                option: opt,
                count: counts[i],
                percentage: totalVotes.value > 0 ? Math.round((counts[i] / totalVotes.value) * 100) : 0
            }))
        } catch (e) {
            console.error('Failed to fetch poll results:', e)
        }
    }

    async function fetchAllPolls() {
        try {
            const supabase = await getSupabaseClient()
            const { data } = await supabase
                .from('polls')
                .select('id, question, options, is_active, created_at')
                .order('created_at', { ascending: false })

            const polls: PollWithResults[] = []

            for (const row of data || []) {
                const poll: Poll = {
                    ...row,
                    options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options
                }

                const { data: votes } = await supabase
                    .from('poll_votes')
                    .select('selected_option')
                    .eq('poll_id', poll.id)

                const total = votes?.length || 0
                const counts = new Array(poll.options.length).fill(0)
                votes?.forEach((v: any) => {
                    if (v.selected_option >= 0 && v.selected_option < poll.options.length) {
                        counts[v.selected_option]++
                    }
                })

                polls.push({
                    ...poll,
                    totalVotes: total,
                    results: poll.options.map((opt, i) => ({
                        option: opt,
                        count: counts[i],
                        percentage: total > 0 ? Math.round((counts[i] / total) * 100) : 0
                    }))
                })
            }

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
            const supabase = await getSupabaseClient()
            await supabase.from('poll_votes').insert({
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
        return localStorage.getItem(POLL_DISMISSED_PREFIX + pollId) === 'true'
    }

    function dismissPoll(pollId: number) {
        localStorage.setItem(POLL_DISMISSED_PREFIX + pollId, 'true')
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
