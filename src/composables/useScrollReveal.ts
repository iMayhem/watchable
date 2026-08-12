/**
 * Scroll Reveal Animation Composable
 * Implements Intersection Observer-based scroll-triggered animations
 * for staggered fade-in effects on content sections
 */

import { onMounted, onBeforeUnmount, Ref, ref } from 'vue';

interface ScrollRevealOptions {
  /** Root margin for early/late triggering (default: '-50px') */
  rootMargin?: string;
  /** Intersection threshold (default: 0.1) */
  threshold?: number;
  /** Delay between staggered elements in ms (default: 100) */
  staggerDelay?: number;
  /** Animation name to apply (default: 'fade-in-up') */
  animation?: 'fade-in' | 'fade-in-up' | 'fade-in-down' | 'fade-in-left' | 'fade-in-right' | 'scale-in';
  /** Only trigger once (default: true) */
  once?: boolean;
}

/**
 * Use scroll reveal for a single element
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useScrollReveal } from '@/composables/useScrollReveal'
 * 
 * const elRef = ref(null)
 * useScrollReveal(elRef, { animation: 'fade-in-up' })
 * </script>
 * 
 * <template>
 *   <div ref="elRef">Content that fades in on scroll</div>
 * </template>
 * ```
 */
export function useScrollReveal(
  elementRef: Ref<HTMLElement | null>,
  options: ScrollRevealOptions = {}
) {
  const {
    rootMargin = '-50px',
    threshold = 0.1,
    animation = 'fade-in-up',
    once = true
  } = options;

  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    if (!elementRef.value) return;

    // Add initial state
    elementRef.value.style.opacity = '0';
    elementRef.value.style.transform = getInitialTransform(animation);

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.classList.add(`animate-${animation}`);
            target.style.opacity = '';
            target.style.transform = '';

            if (once) {
              observer?.unobserve(target);
            }
          } else if (!once) {
            const target = entry.target as HTMLElement;
            target.classList.remove(`animate-${animation}`);
            target.style.opacity = '0';
            target.style.transform = getInitialTransform(animation);
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

  onBeforeUnmount(() => {
    observer?.disconnect();
  });
}

/**
 * Use scroll reveal for multiple elements with stagger effect
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useScrollRevealStagger } from '@/composables/useScrollReveal'
 * 
 * const containerRef = ref(null)
 * useScrollRevealStagger(containerRef, '.card', { staggerDelay: 100 })
 * </script>
 * 
 * <template>
 *   <div ref="containerRef">
 *     <div class="card">Card 1</div>
 *     <div class="card">Card 2</div>
 *     <div class="card">Card 3</div>
 *   </div>
 * </template>
 * ```
 */
export function useScrollRevealStagger(
  containerRef: Ref<HTMLElement | null>,
  selector: string,
  options: ScrollRevealOptions = {}
) {
  const {
    rootMargin = '-50px',
    threshold = 0.1,
    staggerDelay = 100,
    animation = 'fade-in-up',
    once = true
  } = options;

  let observer: IntersectionObserver | null = null;
  const revealedElements = new WeakSet<Element>();

  onMounted(() => {
    if (!containerRef.value) return;

    const elements = containerRef.value.querySelectorAll(selector);
    if (!elements.length) return;

    // Set initial state for all elements
    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.opacity = '0';
      htmlEl.style.transform = getInitialTransform(animation);
    });

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !revealedElements.has(entry.target)) {
            const target = entry.target as HTMLElement;
            const index = Array.from(elements).indexOf(target);
            const delay = index * staggerDelay;

            setTimeout(() => {
              target.classList.add(`animate-${animation}`);
              target.style.opacity = '';
              target.style.transform = '';
              revealedElements.add(target);
            }, delay);

            if (once) {
              observer?.unobserve(target);
            }
          } else if (!once && !entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.classList.remove(`animate-${animation}`);
            target.style.opacity = '0';
            target.style.transform = getInitialTransform(animation);
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    elements.forEach((el) => observer!.observe(el));
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });
}

/**
 * Auto scroll reveal - automatically animates elements with data-scroll-reveal attribute
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useAutoScrollReveal } from '@/composables/useScrollReveal'
 * useAutoScrollReveal()
 * </script>
 * 
 * <template>
 *   <div data-scroll-reveal>Automatically animated!</div>
 *   <div data-scroll-reveal="fade-in-left">Custom animation</div>
 *   <div data-scroll-reveal="scale-in" data-scroll-delay="200">With delay</div>
 * </template>
 * ```
 */
export function useAutoScrollReveal(options: ScrollRevealOptions = {}) {
  const {
    rootMargin = '-50px',
    threshold = 0.1,
    once = true
  } = options;

  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    const elements = document.querySelectorAll('[data-scroll-reveal]');
    if (!elements.length) return;

    // Set initial state
    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.opacity = '0';
      
      const animation = htmlEl.dataset.scrollReveal || 'fade-in-up';
      htmlEl.style.transform = getInitialTransform(animation as ScrollRevealOptions['animation']);
    });

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const animation = target.dataset.scrollReveal || 'fade-in-up';
            const delay = parseInt(target.dataset.scrollDelay || '0', 10);

            setTimeout(() => {
              target.classList.add(`animate-${animation}`);
              target.style.opacity = '';
              target.style.transform = '';
            }, delay);

            if (once) {
              observer?.unobserve(target);
            }
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    elements.forEach((el) => observer!.observe(el));
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });
}

/**
 * Get initial transform for animation type
 */
function getInitialTransform(animation?: string): string {
  switch (animation) {
    case 'fade-in-up':
      return 'translateY(20px)';
    case 'fade-in-down':
      return 'translateY(-20px)';
    case 'fade-in-left':
      return 'translateX(-20px)';
    case 'fade-in-right':
      return 'translateX(20px)';
    case 'scale-in':
      return 'scale(0.92)';
    default:
      return 'none';
  }
}

/**
 * Composable to track if element is in viewport
 * Useful for conditional rendering or logic based on visibility
 */
export function useInViewport(
  elementRef: Ref<HTMLElement | null>,
  options: IntersectionObserverInit = {}
) {
  const isInViewport = ref(false);
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    if (!elementRef.value) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isInViewport.value = entry.isIntersecting;
        });
      },
      {
        rootMargin: '0px',
        threshold: 0.1,
        ...options
      }
    );

    observer.observe(elementRef.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
  });

  return { isInViewport };
}
