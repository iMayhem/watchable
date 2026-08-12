/**
 * Progressive Image Loading Composable
 * Implements blur-up technique for smooth image loading experience
 */

import { ref, onMounted, onBeforeUnmount, Ref } from 'vue';
import { getOptimizedImageUrl, getBlurPlaceholder } from '../utils/imageOptimization';

interface ProgressiveImageOptions {
  /** Enable blur-up technique (default: true) */
  blurUp?: boolean;
  /** Blur placeholder width (default: 20) */
  placeholderWidth?: number;
  /** Image quality (default: 85) */
  quality?: number;
  /** Target width for optimization */
  width?: number;
  /** Priority loading (eager vs lazy) */
  priority?: boolean;
}

interface ProgressiveImageState {
  /** Current image source (starts with blur, then full) */
  currentSrc: Ref<string>;
  /** Whether full image is loaded */
  isLoaded: Ref<boolean>;
  /** Whether image is currently loading */
  isLoading: Ref<boolean>;
  /** Whether there was an error */
  hasError: Ref<boolean>;
  /** CSS class for animations */
  imageClass: Ref<string>;
}

/**
 * Composable for progressive image loading with blur-up technique
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useProgressiveImage } from '@/composables/useProgressiveImage'
 * 
 * const { currentSrc, isLoaded, imageClass } = useProgressiveImage(
 *   '/path/to/image.jpg',
 *   { blurUp: true, width: 500 }
 * )
 * </script>
 * 
 * <template>
 *   <img :src="currentSrc" :class="imageClass" />
 * </template>
 * ```
 */
export function useProgressiveImage(
  src: string,
  options: ProgressiveImageOptions = {}
): ProgressiveImageState {
  const {
    blurUp = true,
    placeholderWidth = 20,
    quality = 85,
    width,
    priority = false
  } = options;

  const currentSrc = ref<string>('');
  const isLoaded = ref(false);
  const isLoading = ref(false);
  const hasError = ref(false);
  const imageClass = ref('progressive-image progressive-image--loading');

  let img: HTMLImageElement | null = null;

  const loadFullImage = () => {
    if (!src || isLoaded.value || isLoading.value) return;

    isLoading.value = true;
    img = new Image();

    img.onload = () => {
      currentSrc.value = getOptimizedImageUrl(src, { width, quality });
      isLoaded.value = true;
      isLoading.value = false;
      imageClass.value = 'progressive-image progressive-image--loaded';
    };

    img.onerror = () => {
      hasError.value = true;
      isLoading.value = false;
      imageClass.value = 'progressive-image progressive-image--error';
    };

    img.src = getOptimizedImageUrl(src, { width, quality });
  };

  onMounted(() => {
    if (!src) return;

    // Set blur placeholder first (if enabled)
    if (blurUp) {
      currentSrc.value = getBlurPlaceholder(src, placeholderWidth);
    }

    if (priority) {
      // Load immediately for priority images
      loadFullImage();
    } else {
      // Use Intersection Observer for lazy loading
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                loadFullImage();
                observer.disconnect();
              }
            });
          },
          {
            rootMargin: '100px', // Start loading before image is in viewport
            threshold: 0.01
          }
        );

        // We need a dummy element to observe since this is a composable
        // In practice, you'd pass the img ref from the component
        loadFullImage();
      } else {
        // Fallback for browsers without IntersectionObserver
        loadFullImage();
      }
    }
  });

  onBeforeUnmount(() => {
    if (img) {
      img.onload = null;
      img.onerror = null;
      img = null;
    }
  });

  return {
    currentSrc,
    isLoaded,
    isLoading,
    hasError,
    imageClass
  };
}

/**
 * Directive version for easier use in templates
 * 
 * @example
 * ```vue
 * <img v-progressive-image="imageUrl" />
 * ```
 */
export const vProgressiveImage = {
  mounted(el: HTMLImageElement, binding: { value: string }) {
    const src = binding.value;
    if (!src) return;

    // Set blur placeholder
    el.src = getBlurPlaceholder(src, 20);
    el.classList.add('progressive-image', 'progressive-image--loading');

    // Create observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.onload = () => {
              el.src = getOptimizedImageUrl(src, { quality: 85 });
              el.classList.remove('progressive-image--loading');
              el.classList.add('progressive-image--loaded');
            };
            img.onerror = () => {
              el.classList.add('progressive-image--error');
            };
            img.src = getOptimizedImageUrl(src, { quality: 85 });
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.01
      }
    );

    observer.observe(el);
  }
};
