const QUERY = /prefers-reduced-motion:\s*reduce/;

export function forceReducedMotion() {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const list = original(query);
    if (!QUERY.test(query)) return list;
    return new Proxy(list, {
      get: (target, key) => {
        if (key === 'matches') return true;
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
  const style = document.createElement('style');
  style.textContent =
    '*,*::before,*::after{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:1ms!important;transition-delay:0s!important;scroll-behavior:auto!important}';
  document.head.appendChild(style);
}
