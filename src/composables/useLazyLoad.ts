/**
 * Lazy Loading Composable
 * Provides intersection observer-based lazy loading for Vue components
 */

import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';

interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
}

/**
 * Use Intersection Observer for lazy loading
 */
export function useLazyLoad(
  targetRef: Ref<HTMLElement | null>,
  options: LazyLoadOptions = {}
) {
  const isVisible = ref(false);
  const hasBeenVisible = ref(false);
  let observer: IntersectionObserver | null = null;

  const {
    rootMargin = '50px',
    threshold = 0.01,
    once = true
  } = options;

  onMounted(() => {
    if (!targetRef.value) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible.value = entry.isIntersecting;
          
          if (entry.isIntersecting) {
            hasBeenVisible.value = true;
            
            if (once && observer) {
              observer.disconnect();
            }
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(targetRef.value);
  });

  onUnmounted(() => {
    if (observer) {
      observer.disconnect();
    }
  });

  return {
    isVisible,
    hasBeenVisible
  };
}

/**
 * Use lazy loading for images
 */
export function useLazyImage(
  imgRef: Ref<HTMLImageElement | null>,
  src: string,
  options: LazyLoadOptions = {}
) {
  const isLoaded = ref(false);
  const isError = ref(false);
  let observer: IntersectionObserver | null = null;

  const {
    rootMargin = '100px',
    threshold = 0.01
  } = options;

  onMounted(() => {
    if (!imgRef.value) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && imgRef.value) {
            const img = imgRef.value;
            
            img.onload = () => {
              isLoaded.value = true;
              img.classList.add('loaded');
            };
            
            img.onerror = () => {
              isError.value = true;
            };
            
            img.src = src;
            
            if (observer) {
              observer.disconnect();
            }
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(imgRef.value);
  });

  onUnmounted(() => {
    if (observer) {
      observer.disconnect();
    }
  });

  return {
    isLoaded,
    isError
  };
}

/**
 * Use lazy loading for background images
 */
export function useLazyBackground(
  elementRef: Ref<HTMLElement | null>,
  imageUrl: string,
  options: LazyLoadOptions = {}
) {
  const isLoaded = ref(false);
  let observer: IntersectionObserver | null = null;

  const {
    rootMargin = '100px',
    threshold = 0.01
  } = options;

  onMounted(() => {
    if (!elementRef.value) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && elementRef.value) {
            // Preload image
            const img = new Image();
            img.onload = () => {
              if (elementRef.value) {
                elementRef.value.style.backgroundImage = `url(${imageUrl})`;
                isLoaded.value = true;
              }
            };
            img.src = imageUrl;
            
            if (observer) {
              observer.disconnect();
            }
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(elementRef.value);
  });

  onUnmounted(() => {
    if (observer) {
      observer.disconnect();
    }
  });

  return {
    isLoaded
  };
}

interface InfiniteScrollOptions {
    enabled: Ref<boolean>;
    busy?: Ref<boolean>;
    rootMargin?: string;
}

/** Trigger loadMore when a bottom sentinel enters the viewport. */
export function useInfiniteScroll(
    sentinelRef: Ref<HTMLElement | null>,
    onLoad: () => void | Promise<void>,
    options: InfiniteScrollOptions
) {
    let observer: IntersectionObserver | null = null;

    const bind = () => {
        observer?.disconnect();
        observer = null;
        if (!sentinelRef.value || !options.enabled.value) return;

        observer = new IntersectionObserver(
            (entries) => {
                if (!options.enabled.value || options.busy?.value) return;
                if (entries.some((entry) => entry.isIntersecting)) {
                    void onLoad();
                }
            },
            {
                rootMargin: options.rootMargin ?? '480px 0px',
                threshold: 0
            }
        );
        observer.observe(sentinelRef.value);
    };

    watch(
        [sentinelRef, options.enabled, () => options.busy?.value],
        () => bind(),
        { flush: 'post' }
    );

    onMounted(() => bind());

    onUnmounted(() => {
        observer?.disconnect();
        observer = null;
    });
}

/**
 * Use debounced scroll handler
 */
export function useDebouncedScroll(
  callback: () => void,
  delay: number = 100
) {
  let timeoutId: ReturnType<typeof setTimeout>;

  const debouncedCallback = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, delay);
  };

  onMounted(() => {
    window.addEventListener('scroll', debouncedCallback, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener('scroll', debouncedCallback);
    clearTimeout(timeoutId);
  });
}

/**
 * Use throttled resize handler
 */
export function useThrottledResize(
  callback: () => void,
  delay: number = 200
) {
  let lastCall = 0;

  const throttledCallback = () => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      callback();
    }
  };

  onMounted(() => {
    window.addEventListener('resize', throttledCallback, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener('resize', throttledCallback);
  });
}
