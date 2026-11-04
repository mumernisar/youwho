/** Running from the home screen (installed), not in a browser tab. iPhone reports it through `navigator.standalone`. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Which install steps to show. iPadOS Safari reports itself as a Mac, so touch support tells them apart. */
export function platform(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}
