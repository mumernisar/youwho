/** Running from the home screen (installed), not in a browser tab. iPhone reports it through `navigator.standalone`. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Which install steps to show. iPadOS Safari reports itself as a Mac, so touch support tells them apart. */
export function platform(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** Set once from the installed app. Lets the server skip the install ribbon (Android shares cookies with Chrome). */
export const APP_COOKIE = 'yw_app';
/** Set when the ribbon is closed; the server stops rendering it for 90 days. */
export const RIBBON_COOKIE = 'yw_ribbon';
export const RIBBON_DAYS = 90;
