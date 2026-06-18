<template>
    <div class="admin-page">
        <SiteHeader />

        <main id="main" class="admin-page__main container-lm" role="main">
            <section class="admin-page__masthead">
                <p class="eyebrow admin-page__eyebrow">House Control</p>
                <h1 class="admin-page__title display">Admin Panel</h1>
                <p class="admin-page__subtitle">
                    Select and curate everyday's 10 trending 4K movies shown on the homepage.
                </p>
            </section>

            <div class="admin-page__grid">
                <!-- Left panel: Current curation list -->
                <section class="admin-page__panel">
                    <div class="admin-page__panel-header">
                        <h2 class="admin-page__panel-title">Today's 4K Selection ({{ selectedMovies.length }}/10)</h2>
                        <button 
                            type="button" 
                            class="btn btn--primary" 
                            :disabled="isSaving" 
                            @click="saveSelection"
                        >
                            {{ isSaving ? 'Saving...' : 'Save Curation' }}
                        </button>
                    </div>

                    <div v-if="saveMessage" :class="['admin-page__alert', `admin-page__alert--${saveStatus}`]">
                        {{ saveMessage }}
                    </div>

                    <div v-if="isLoadingCuration" class="admin-page__status">
                        <div class="spinner" />
                        <span class="meta">Loading current selection...</span>
                    </div>

                    <div v-else-if="selectedMovies.length === 0" class="admin-page__empty-selection">
                        <p class="meta">No 4K movies selected yet. Search and add movies from the search panel on the right.</p>
                    </div>

                    <ul v-else class="curation-list" role="list">
                        <li v-for="(movie, index) in selectedMovies" :key="movie.id" class="curation-card">
                            <span class="curation-card__index">{{ index + 1 }}</span>
                            <img 
                                v-if="movie.posterPath" 
                                :src="getPosterUrl(movie.posterPath)" 
                                :alt="movie.title" 
                                class="curation-card__img" 
                            />
                            <div v-else class="curation-card__img-fallback">{{ movie.title[0] }}</div>
                            
                            <div class="curation-card__details">
                                <h4 class="curation-card__title">{{ movie.title }}</h4>
                                <span class="curation-card__meta meta">{{ movie.releaseDate ? movie.releaseDate.split('-')[0] : 'N/A' }}</span>
                            </div>

                            <div class="curation-card__actions">
                                <button 
                                    type="button" 
                                    class="action-btn" 
                                    :disabled="index === 0" 
                                    title="Move Up" 
                                    @click="moveUp(index)"
                                >
                                    ↑
                                </button>
                                <button 
                                    type="button" 
                                    class="action-btn" 
                                    :disabled="index === selectedMovies.length - 1" 
                                    title="Move Down" 
                                    @click="moveDown(index)"
                                >
                                    ↓
                                </button>
                                <button 
                                    type="button" 
                                    class="action-btn action-btn--danger" 
                                    title="Remove" 
                                    @click="removeMovie(movie.id)"
                                >
                                    ✕
                                </button>
                            </div>
                        </li>
                    </ul>
                </section>

                <!-- Right panel: Movie search and add tools -->
                <section class="admin-page__panel">
                    <h2 class="admin-page__panel-title">Search TMDB to Add Movies</h2>
                    <form class="admin-page__search" @submit.prevent="searchMovies">
                        <input 
                            type="search" 
                            class="admin-page__search-input" 
                            placeholder="Type movie title..." 
                            v-model="searchQuery"
                            @input="onSearchInput"
                        />
                        <button type="submit" class="btn">Search</button>
                    </form>

                    <div v-if="isSearching" class="admin-page__status">
                        <div class="spinner" />
                        <span class="meta">Searching TMDB...</span>
                    </div>

                    <div v-else-if="searchResults.length === 0 && searchQuery" class="admin-page__empty-selection">
                        <p class="meta">No movies found matching "{{ searchQuery }}"</p>
                    </div>

                    <ul v-else class="search-results-list">
                        <li v-for="movie in searchResults" :key="movie.id" class="search-result-card">
                            <img 
                                v-if="movie.poster_path" 
                                :src="getPosterUrl(movie.poster_path)" 
                                :alt="movie.title" 
                                class="search-result-card__img" 
                            />
                            <div v-else class="search-result-card__img-fallback">M</div>

                            <div class="search-result-card__details">
                                <h4 class="search-result-card__title">{{ movie.title || movie.original_title }}</h4>
                                <span class="search-result-card__meta meta">
                                    {{ movie.release_date ? movie.release_date.split('-')[0] : 'N/A' }}
                                </span>
                            </div>

                            <button 
                                type="button" 
                                class="btn btn--sm" 
                                :disabled="isAlreadyAdded(movie.id) || selectedMovies.length >= 10"
                                @click="addMovie(movie)"
                            >
                                {{ isAlreadyAdded(movie.id) ? 'Added' : 'Add to 4K' }}
                            </button>
                        </li>
                    </ul>
                </section>
            </div>
        </main>

        <SiteFooter />
    </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import SiteHeader from '../components/navigation/SiteHeader.vue';
import SiteFooter from '../components/navigation/SiteFooter.vue';
import useAxios from '../composables/useAxios';
import { getSupabaseClient } from '../lib/supabase';
import { useWebImage } from '../utils/useWebImage';

interface SelectedMovie {
    id: number;
    title: string;
    originalTitle?: string;
    posterPath: string | null;
    rating?: number;
    releaseDate?: string;
    genreIds?: number[];
    adult?: boolean;
    type?: 'movie';
}

export default defineComponent({
    name: 'Admin',
    components: { SiteHeader, SiteFooter },
    setup() {
        const selectedMovies = ref<SelectedMovie[]>([]);
        const searchQuery = ref('');
        const searchResults = ref<any[]>([]);
        const isSaving = ref(false);
        const isLoadingCuration = ref(false);
        const isSearching = ref(false);
        const saveMessage = ref('');
        const saveStatus = ref<'success' | 'error' | ''>('');

        let searchDebounceTimer: number | null = null;

        const getPosterUrl = (path: string | null) => {
            if (!path) return '';
            return useWebImage(path, 'small');
        };

        const loadCurrentCuration = async () => {
            isLoadingCuration.value = true;
            try {
                const supabase = await getSupabaseClient();
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', '4k_movies_today')
                    .single();
                
                if (error && error.code !== 'PGRST116') {
                    throw error;
                }

                if (data && data.value) {
                    selectedMovies.value = JSON.parse(data.value);
                }
            } catch (err) {
                console.error('Failed to load curation:', err);
                saveMessage.value = 'Failed to load existing 4K curation from database.';
                saveStatus.value = 'error';
            } finally {
                isLoadingCuration.value = false;
            }
        };

        const searchMovies = async () => {
            if (!searchQuery.value.trim()) return;
            isSearching.value = true;
            try {
                const res = await useAxios().get('https://api.themoviedb.org/3/search/movie', {
                    params: {
                        query: searchQuery.value,
                        page: 1,
                        language: 'en-US'
                    }
                });
                searchResults.value = res.data.results || [];
            } catch (err) {
                console.error('Failed to search movies:', err);
            } finally {
                isSearching.value = false;
            }
        };

        const onSearchInput = () => {
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }
            searchDebounceTimer = window.setTimeout(() => {
                if (searchQuery.value.trim()) {
                    searchMovies();
                } else {
                    searchResults.value = [];
                }
            }, 400);
        };

        const isAlreadyAdded = (id: number) => {
            return selectedMovies.value.some(m => m.id === id);
        };

        const addMovie = (movie: any) => {
            if (selectedMovies.value.length >= 10) return;
            if (isAlreadyAdded(movie.id)) return;

            selectedMovies.value.push({
                id: movie.id,
                title: movie.title || movie.original_title,
                originalTitle: movie.original_title,
                posterPath: movie.poster_path,
                rating: movie.vote_average,
                releaseDate: movie.release_date,
                genreIds: movie.genre_ids,
                adult: movie.adult,
                type: 'movie'
            });
        };

        const removeMovie = (id: number) => {
            selectedMovies.value = selectedMovies.value.filter(m => m.id !== id);
        };

        const moveUp = (index: number) => {
            if (index <= 0) return;
            const temp = selectedMovies.value[index];
            selectedMovies.value[index] = selectedMovies.value[index - 1];
            selectedMovies.value[index - 1] = temp;
        };

        const moveDown = (index: number) => {
            if (index >= selectedMovies.value.length - 1) return;
            const temp = selectedMovies.value[index];
            selectedMovies.value[index] = selectedMovies.value[index + 1];
            selectedMovies.value[index + 1] = temp;
        };

        const saveSelection = async () => {
            isSaving.value = true;
            saveMessage.value = '';
            saveStatus.value = '';
            try {
                const supabase = await getSupabaseClient();
                
                // Fetch first to see if it exists
                const { data: existing } = await supabase
                    .from('app_settings')
                    .select('*')
                    .eq('key', '4k_movies_today');

                let error;
                if (existing && existing.length > 0) {
                    const res = await supabase
                        .from('app_settings')
                        .update({ value: JSON.stringify(selectedMovies.value) })
                        .eq('key', '4k_movies_today');
                    error = res.error;
                } else {
                    const res = await supabase
                        .from('app_settings')
                        .insert([{ key: '4k_movies_today', value: JSON.stringify(selectedMovies.value) }]);
                    error = res.error;
                }

                if (error) throw error;

                saveMessage.value = '4K movies curation successfully saved and live!';
                saveStatus.value = 'success';
            } catch (err) {
                console.error('Failed to save curation:', err);
                saveMessage.value = 'Failed to save curation to database.';
                saveStatus.value = 'error';
            } finally {
                isSaving.value = false;
            }
        };

        onMounted(() => {
            loadCurrentCuration();
        });

        return {
            selectedMovies,
            searchQuery,
            searchResults,
            isSaving,
            isLoadingCuration,
            isSearching,
            saveMessage,
            saveStatus,
            getPosterUrl,
            onSearchInput,
            searchMovies,
            isAlreadyAdded,
            addMovie,
            removeMovie,
            moveUp,
            moveDown,
            saveSelection
        };
    }
});
</script>

<style lang="scss" scoped>
.admin-page {
    &__main {
        padding-top: 100px;
        padding-bottom: var(--s-8);
        min-height: 80vh;
    }

    &__masthead {
        margin-bottom: var(--s-6);
    }

    &__subtitle {
        color: var(--bone-300);
        margin-top: var(--s-2);
        max-width: 600px;
    }

    &__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-6);

        @media (max-width: 900px) {
            grid-template-columns: 1fr;
        }
    }

    &__panel {
        background: var(--ink-800);
        border: 1px solid var(--rule);
        border-radius: var(--r-lg);
        padding: var(--s-5);
        display: flex;
        flex-direction: column;
        gap: var(--s-4);
        height: max-content;
    }

    &__panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s-3);
    }

    &__panel-title {
        font-family: var(--font-display);
        font-size: var(--fs-lg);
        font-weight: 600;
        color: var(--bone-50);
        margin: 0;
    }

    &__alert {
        padding: var(--s-3) var(--s-4);
        border-radius: var(--r-md);
        font-size: var(--fs-sm);

        &--success {
            background: rgba(46, 125, 50, 0.15);
            border: 1px solid rgba(46, 125, 50, 0.3);
            color: #81c784;
        }

        &--error {
            background: rgba(198, 40, 40, 0.15);
            border: 1px solid rgba(198, 40, 40, 0.3);
            color: #e57373;
        }
    }

    &__search {
        display: flex;
        gap: var(--s-2);
    }

    &__search-input {
        flex: 1;
        background: var(--ink-700);
        border: 1px solid var(--rule-strong);
        border-radius: var(--r-md);
        padding: var(--s-2) var(--s-3);
        color: var(--bone-50);
        font-family: inherit;

        &:focus {
            outline: 1px solid var(--ember);
        }
    }

    &__status {
        display: flex;
        align-items: center;
        gap: var(--s-3);
        color: var(--bone-400);
        padding: var(--s-4) 0;
    }

    &__empty-selection {
        border: 2px dashed var(--rule);
        border-radius: var(--r-md);
        padding: var(--s-6);
        text-align: center;
    }
}

.curation-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
}

.curation-card {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    background: var(--ink-700);
    border-radius: var(--r-md);
    padding: var(--s-2) var(--s-3);

    &__index {
        font-family: var(--font-mono);
        color: var(--bone-400);
        width: 20px;
    }

    &__img {
        width: 36px;
        height: 54px;
        object-fit: cover;
        border-radius: var(--r-sm);
    }

    &__img-fallback {
        width: 36px;
        height: 54px;
        background: var(--ink-600);
        border-radius: var(--r-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--bone-400);
        font-weight: 700;
    }

    &__details {
        flex: 1;
        min-width: 0;
    }

    &__title {
        font-size: var(--fs-base);
        font-weight: 500;
        color: var(--bone-50);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__actions {
        display: flex;
        gap: var(--s-1);
    }
}

.search-results-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    max-height: 480px;
    overflow-y: auto;
    padding-right: var(--s-2);
}

.search-result-card {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    background: var(--ink-700);
    border-radius: var(--r-md);
    padding: var(--s-2) var(--s-3);

    &__img {
        width: 36px;
        height: 54px;
        object-fit: cover;
        border-radius: var(--r-sm);
    }

    &__img-fallback {
        width: 36px;
        height: 54px;
        background: var(--ink-600);
        border-radius: var(--r-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--bone-400);
        font-weight: 700;
    }

    &__details {
        flex: 1;
        min-width: 0;
    }

    &__title {
        font-size: var(--fs-base);
        font-weight: 500;
        color: var(--bone-50);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}

.btn {
    background: var(--ink-600);
    border: 1px solid var(--rule-strong);
    color: var(--bone-50);
    padding: var(--s-2) var(--s-4);
    border-radius: var(--r-md);
    cursor: pointer;
    font-weight: 500;
    font-family: inherit;
    transition: all var(--dur-fast) var(--ease-out);

    &:hover:not(:disabled) {
        background: var(--ink-500);
        border-color: var(--bone-400);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    &--primary {
        background: var(--ember);
        border-color: transparent;
        color: #fff;

        &:hover:not(:disabled) {
            background: var(--ember-hover);
        }
    }

    &--sm {
        padding: var(--s-1) var(--s-3);
        font-size: var(--fs-sm);
    }
}

.action-btn {
    background: transparent;
    border: none;
    color: var(--bone-300);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color var(--dur-fast);

    &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        color: var(--bone-50);
    }

    &:disabled {
        opacity: 0.2;
        cursor: not-allowed;
    }

    &--danger {
        color: #e57373;
        &:hover {
            background: rgba(229, 115, 115, 0.15) !important;
            color: #ff8a80 !important;
        }
    }
}

.spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--rule-strong);
    border-top-color: var(--ember);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
