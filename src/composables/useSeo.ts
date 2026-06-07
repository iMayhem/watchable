export function useSeo() {
  const setMeta = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const setProperty = (property: string, content: string) => {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const setLink = (rel: string, href: string) => {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  };

  const updateSeo = (opt: {
    title: string;
    description?: string;
    keywords?: string;
    image?: string;
    canonical?: string;
    type?: string;
  }) => {
    document.title = opt.title;

    const baseDesc = 'Watch movies, TV shows, and anime online in high quality. Host watch parties with friends, search from a vast database of titles, and enjoy uninterrupted streaming on Moovie.';
    const desc = opt.description || baseDesc;
    setMeta('description', desc);

    if (opt.keywords) {
      setMeta('keywords', opt.keywords);
    }

    // Open Graph
    setProperty('og:title', opt.title);
    setProperty('og:description', desc);
    setProperty('og:type', opt.type || 'website');
    if (opt.image) {
      setProperty('og:image', opt.image);
    }

    // Twitter
    setProperty('twitter:title', opt.title);
    setProperty('twitter:description', desc);
    if (opt.image) {
      setProperty('twitter:image', opt.image);
    }

    // Canonical
    if (opt.canonical) {
      setLink('canonical', opt.canonical);
    }
  };

  return { updateSeo };
}
