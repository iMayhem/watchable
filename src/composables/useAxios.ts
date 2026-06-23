import axios from 'axios'
import {
    applyGlobalBrowseCuration,
    GLOBAL_DEFAULT_ORIGINAL_LANGUAGE,
    shouldApplyGlobalHollywoodBias,
    shouldCurateGlobalBrowse
} from './useHomepageCuration'
import { getSettings } from './useSettings'

// Always call TMDB directly — skip the /api/tmdb Cloudflare proxy.
const BASE_URL = 'https://api.themoviedb.org/3/'
const API_KEY = import.meta.env.VITE_API_KEY || 'dfa4c2c7c1de1005adee824dc5593672'

const useAxios = () => {
    const { region, language } = getSettings()
    const params: Record<string, string> = {
        api_key: API_KEY
    }

    if (language.value) {
        params.language = language.value
    }

    const axiosInstance = axios.create({
        baseURL: BASE_URL,
        params,
        headers: {
            'Content-Type': 'application/json',
        }
    })

    const getRecentDateRange = () => {
        const today = new Date()
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setDate(today.getDate() - 180)

        const formatDate = (d: Date) => {
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        }

        return {
            gte: formatDate(sixMonthsAgo),
            lte: formatDate(today)
        }
    }

    const MIN_RELEASE_DATE = '2015-01-01'

    axiosInstance.interceptors.request.use((config) => {
        let url = config.url || ''
        const regionVal = region.value

        if (url.includes('?')) {
            const [base, queryStr] = url.split('?')
            config.url = base
            
            const urlParams = new URLSearchParams(queryStr)
            config.params = config.params || {}
            for (const [key, val] of urlParams.entries()) {
                if (config.params[key] === undefined) {
                    config.params[key] = val
                }
            }
        }

        config.params = config.params || {}
        url = config.url || ''

        if (shouldApplyGlobalHollywoodBias(regionVal, url, config.params)) {
            config.params.with_original_language = GLOBAL_DEFAULT_ORIGINAL_LANGUAGE

            if (url.includes('trending/movie') || url.includes('movie/popular')) {
                config.url = 'discover/movie'
                config.params = {
                    ...config.params,
                    sort_by: config.params.sort_by || 'popularity.desc',
                    'primary_release_date.gte': MIN_RELEASE_DATE,
                    'vote_count.gte': config.params['vote_count.gte'] || 50
                }
            } else if (url.includes('movie/now_playing')) {
                const dates = getRecentDateRange()
                config.url = 'discover/movie'
                config.params = {
                    ...config.params,
                    sort_by: config.params.sort_by || 'primary_release_date.desc',
                    'primary_release_date.gte': dates.gte,
                    'primary_release_date.lte': dates.lte,
                    'vote_count.gte': config.params['vote_count.gte'] || 20
                }
            } else if (url.includes('trending/tv')) {
                config.url = 'discover/tv'
                config.params = {
                    ...config.params,
                    sort_by: config.params.sort_by || 'popularity.desc',
                    without_genres: config.params.without_genres || '10767,10763,10766',
                    'first_air_date.gte': MIN_RELEASE_DATE,
                    'vote_count.gte': config.params['vote_count.gte'] || 50
                }
            } else if (url.includes('tv/on_the_air')) {
                const dates = getRecentDateRange()
                config.url = 'discover/tv'
                config.params = {
                    ...config.params,
                    sort_by: config.params.sort_by || 'first_air_date.desc',
                    without_genres: config.params.without_genres || '10767,10763,10766',
                    'first_air_date.gte': dates.gte,
                    'first_air_date.lte': dates.lte,
                    'vote_count.gte': config.params['vote_count.gte'] || 20
                }
            }
        }

        if (regionVal && regionVal !== 'global') {
            console.log('[🌐 API] Region applied to request:', regionVal)
            const currentSort = config.params.sort_by
            const defaultMovieSort = 'primary_release_date.desc'
            const defaultTVSort = 'first_air_date.desc'

            const getOverriddenSort = (defaultSort: string) => {
                if (!currentSort || currentSort === 'popularity.desc') {
                    return defaultSort
                }
                return currentSort
            }

            if (url.includes('trending/movie') || url.includes('movie/popular')) {
                config.url = 'discover/movie'
                config.params = {
                    ...config.params,
                    sort_by: getOverriddenSort(defaultMovieSort),
                    with_origin_country: regionVal,
                    watch_region: regionVal,
                    region: regionVal,
                    'primary_release_date.gte': MIN_RELEASE_DATE,
                    'vote_count.gte': 7
                }
            } else if (url.includes('movie/now_playing')) {
                const dates = getRecentDateRange()
                config.url = 'discover/movie'
                config.params = {
                    ...config.params,
                    sort_by: getOverriddenSort(defaultMovieSort),
                    with_origin_country: regionVal,
                    watch_region: regionVal,
                    region: regionVal,
                    'primary_release_date.gte': dates.gte,
                    'primary_release_date.lte': dates.lte,
                    'vote_count.gte': 7
                }
            } else if (url.includes('trending/tv') || url.includes('tv/popular')) {
                config.url = 'discover/tv'
                config.params = {
                    ...config.params,
                    sort_by: getOverriddenSort(defaultTVSort),
                    with_origin_country: regionVal,
                    watch_region: regionVal,
                    region: regionVal,
                    without_genres: '10767,10763,10766',
                    'first_air_date.gte': MIN_RELEASE_DATE,
                    'vote_count.gte': 7
                }
            } else if (url.includes('tv/on_the_air')) {
                const dates = getRecentDateRange()
                config.url = 'discover/tv'
                config.params = {
                    ...config.params,
                    sort_by: getOverriddenSort(defaultTVSort),
                    with_origin_country: regionVal,
                    watch_region: regionVal,
                    region: regionVal,
                    without_genres: '10767,10763,10766',
                    'first_air_date.gte': dates.gte,
                    'first_air_date.lte': dates.lte,
                    'vote_count.gte': 7
                }
            } else if (url.includes('discover/movie')) {
                if (!config.params.with_original_language) {
                    config.params.with_origin_country = regionVal
                }
                config.params.watch_region = regionVal
                config.params.region = regionVal
                config.params.sort_by = getOverriddenSort(defaultMovieSort)
                if (!config.params['primary_release_date.gte'] && !config.params['primary_release_date.lte']) {
                    config.params['primary_release_date.gte'] = MIN_RELEASE_DATE
                }
                if (config.params.sort_by === 'primary_release_date.desc') {
                    config.params['vote_count.gte'] = config.params['vote_count.gte'] || 7
                }
            } else if (url.includes('discover/tv')) {
                if (!config.params.with_original_language) {
                    config.params.with_origin_country = regionVal
                }
                config.params.watch_region = regionVal
                config.params.region = regionVal
                config.params.sort_by = getOverriddenSort(defaultTVSort)
                config.params.without_genres = config.params.without_genres || '10767,10763,10766'
                if (!config.params['first_air_date.gte'] && !config.params['first_air_date.lte']) {
                    config.params['first_air_date.gte'] = MIN_RELEASE_DATE
                }
                if (config.params.sort_by === 'first_air_date.desc') {
                    config.params['vote_count.gte'] = config.params['vote_count.gte'] || 7
                }
            } else if (url.includes('search/')) {
                config.params.region = regionVal
            }
        }
        return config
    })

    axiosInstance.interceptors.response.use((response) => {
        const regionVal = region.value
        const url = response.config.url || ''
        const currentSort = response.config.params?.sort_by
        console.log('[🌐 API] Response:', { status: response.status, items: response.data?.results?.length || 0, region: regionVal })

        const requestParams = response.config.params as Record<string, unknown> | undefined
        if (
            response.data &&
            Array.isArray(response.data.results) &&
            shouldCurateGlobalBrowse(regionVal, url, requestParams)
        ) {
            response.data.results = applyGlobalBrowseCuration(response.data.results, {
                excludeIndian: true
            })
        }

        const isChronologicalSort = currentSort === 'primary_release_date.desc' || currentSort === 'first_air_date.desc'

        if (regionVal && regionVal !== 'global' && isChronologicalSort && response.data && Array.isArray(response.data.results)) {
            if (url.includes('discover/movie') || url.includes('discover/tv')) {
                let items = response.data.results as any[]
                console.log('[🌐 API] Processing', items.length, 'items for regional sorting')

                const getYear = (item: any) => {
                    const dateStr = item.release_date || item.first_air_date || ''
                    if (!dateStr) return 0
                    const parts = dateStr.split('-')
                    return parts[0] ? parseInt(parts[0], 10) : 0
                }

                const getVoteCount = (item: any) => {
                    return typeof item.vote_count === 'number' ? item.vote_count : 0
                }

                const getReleaseTime = (item: any) => {
                    const dateStr = item.release_date || item.first_air_date || ''
                    if (!dateStr) return 0
                    return new Date(dateStr).getTime()
                }

                // Filter out items with vote count < 7
                const beforeFilter = items.length
                items = items.filter(item => getVoteCount(item) >= 7)
                console.log('[🌐 API] Filtered:', { before: beforeFilter, after: items.length })

                // Sort: 
                // 1. Year descending.
                // 2. Priority bucket based on vote count:
                //    - vote_count >= 10: priority 10
                //    - vote_count is 7-9: priority is vote_count
                // 3. Within same priority and year: sort by release date descending
                items.sort((a, b) => {
                    const yearA = getYear(a)
                    const yearB = getYear(b)

                    if (yearA !== yearB) {
                        return yearB - yearA
                    }

                    const vcA = getVoteCount(a)
                    const vcB = getVoteCount(b)

                    const getPriority = (vc: number) => {
                        if (vc >= 10) return 10
                        return vc
                    }

                    const priorityA = getPriority(vcA)
                    const priorityB = getPriority(vcB)

                    if (priorityA !== priorityB) {
                        return priorityB - priorityA
                    }

                    const timeA = getReleaseTime(a)
                    const timeB = getReleaseTime(b)
                    return timeB - timeA
                })

                response.data.results = items
            }
        }
        return response
    })

    return axiosInstance
}

export default useAxios