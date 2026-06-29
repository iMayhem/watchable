import { ref } from 'vue'
import { getSupabaseClient } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'

export interface AppNotification {
    id: number
    title: string
    message: string
    type: string
    created_at: string
    created_by: string
    read?: boolean
}

const notifications = ref<AppNotification[]>([])
const unreadCount = ref(0)
const loading = ref(false)

const LOCAL_STORAGE_KEY = 'notification_reads_local'

function getLocalReadIds(): number[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function addLocalReadId(id: number) {
    const ids = getLocalReadIds()
    if (!ids.includes(id)) {
        ids.push(id)
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ids))
    }
}

function addLocalReadIds(ids: number[]) {
    const existing = getLocalReadIds()
    const merged = [...new Set([...existing, ...ids])]
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
}

export function useNotifications() {
    async function fetchNotifications() {
        loading.value = true
        try {
            const supabase = await getSupabaseClient()
            const { data: notifs } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })

            const username = getCurrentUser()
            let readIds: number[] = []

            if (username && notifs?.length) {
                const { data: reads } = await supabase
                    .from('notification_reads')
                    .select('notification_id')
                    .eq('username', username)
                    .in('notification_id', notifs.map((n: any) => n.id))
                if (reads) readIds = reads.map((r: any) => r.notification_id)
            }

            const localReadIds = getLocalReadIds()
            const allReadIds = [...new Set([...readIds, ...localReadIds])]

            notifications.value = (notifs || []).map((n: any) => ({
                ...n,
                read: allReadIds.includes(n.id)
            }))
            unreadCount.value = notifications.value.filter(n => !n.read).length
        } catch (e) {
            console.error('Failed to fetch notifications:', e)
        } finally {
            loading.value = false
        }
    }

    async function markAsRead(notificationId: number) {
        const username = getCurrentUser()
        if (username) {
            try {
                const supabase = await getSupabaseClient()
                await supabase.from('notification_reads').upsert({
                    notification_id: notificationId,
                    username,
                    read_at: new Date().toISOString()
                }, { onConflict: 'notification_id,username' })
            } catch (e) {
                console.error('Failed to mark notification as read:', e)
                return
            }
        } else {
            addLocalReadId(notificationId)
        }
        const n = notifications.value.find(n => n.id === notificationId)
        if (n) n.read = true
        unreadCount.value = Math.max(0, notifications.value.filter(n => !n.read).length)
    }

    async function markAllAsRead() {
        const username = getCurrentUser()
        try {
            const unread = notifications.value.filter(n => !n.read)
            if (!unread.length) return

            if (username) {
                const supabase = await getSupabaseClient()
                const reads = unread.map(n => ({
                    notification_id: n.id,
                    username,
                    read_at: new Date().toISOString()
                }))
                await supabase.from('notification_reads').upsert(reads, { onConflict: 'notification_id,username' })
            } else {
                addLocalReadIds(unread.map(n => n.id))
            }

            notifications.value.forEach(n => { n.read = true })
            unreadCount.value = 0
        } catch (e) {
            console.error('Failed to mark all as read:', e)
        }
    }

    return {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead
    }
}
