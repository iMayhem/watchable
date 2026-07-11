/**
 * Image Optimization Utilities
 * Provides lazy loading, WebP conversion, and responsive image handling
 */

import { buildWsrvImageUrl } from './useWebImage';

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  blur?: number;
}

const TMDB_BASE = 'https://proxy.moovie.fun/tmdb-image/t/p/';

/**
 * Generate optimized image URL via wsrv.nl (production) or direct TMDB (dev).
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: ImageOptions = {}
): string {
  if (!originalUrl) return '';

  if (originalUrl.startsWith('http') && !originalUrl.includes('tmdb.org')) {
    if (import.meta.env.DEV) return originalUrl;
    return buildWsrvImageUrl(originalUrl, {
      width: options.width,
      quality: options.quality,
      blur: options.blur
    });
  }

  let tmdbPath: string;
  if (originalUrl.startsWith('/') && !originalUrl.startsWith('/api')) {
    const clean = originalUrl.slice(1);
    tmdbPath = `original/${clean}`;
  } else if (originalUrl.includes('image.tmdb.org')) {
    const match = originalUrl.match(/\/t\/p\/(.+)/);
    tmdbPath = match ? match[1] : `original/${originalUrl.split('/').pop()}`;
  } else {
    return originalUrl;
  }

  if (import.meta.env.DEV) {
    return `${TMDB_BASE}${tmdbPath}`;
  }

  return buildWsrvImageUrl(`${TMDB_BASE}${tmdbPath}`, {
    width: options.width,
    quality: options.quality,
    blur: options.blur
  });
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(
  originalUrl: string,
  widths: number[] = [320, 640, 960, 1280, 1920]
): string {
  return widths
    .map(width => `${getOptimizedImageUrl(originalUrl, { width })} ${width}w`)
    .join(', ');
}

/**
 * Lazy load image with Intersection Observer
 */
export function lazyLoadImage(
  img: HTMLImageElement,
  src: string,
  options: IntersectionObserverInit = {}
): () => void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target as HTMLImageElement;
        target.src = src;
        target.classList.add('loaded');
        observer.unobserve(target);
      }
    });
  }, {
    rootMargin: '50px',
    threshold: 0.01,
    ...options
  });

  observer.observe(img);

  return () => observer.disconnect();
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Generate blur placeholder data URL
 */
export function getBlurPlaceholder(
  originalUrl: string,
  width: number = 20
): string {
  return getOptimizedImageUrl(originalUrl, {
    width,
    quality: 10,
    blur: 5
  });
}

/**
 * Check if WebP is supported
 */
export function isWebPSupported(): boolean {
  if (typeof window === 'undefined') return false;

  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
}

/**
 * Debounced image loader for scroll performance
 */
export function createDebouncedImageLoader(delay: number = 100) {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (callback: () => void) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, delay);
  };
}