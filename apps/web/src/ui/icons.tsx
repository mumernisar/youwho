/** Inline icons (24px grid, stroke). Kept here so no icon library ships to the browser. */
type P = { className?: string };

const base = (d: React.ReactNode, { className = 'h-5 w-5' }: P) => (
  <svg aria-hidden viewBox="0 0 24 24" className={`fill-none stroke-current ${className}`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export const ChevronLeft = (p: P) => base(<path d="m15 5-7 7 7 7" />, p);
export const ChevronRight = (p: P) => base(<path d="m9 5 7 7-7 7" />, p);
export const ChevronDown = (p: P) => base(<path d="m5 9 7 7 7-7" />, p);
export const ArrowRight = (p: P) => base(<path d="M5 12h14m-6-6 6 6-6 6" />, p);
export const Search = (p: P) => base(<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>, p);
export const Clock = (p: P) => base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, p);
export const Calendar = (p: P) => base(<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4m8-4v4" /></>, p);
export const Door = (p: P) => base(<><path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18" /><circle cx="15" cy="12" r="1" /></>, p);
export const Chair = (p: P) => base(<><path d="M7 11V5.5A2.5 2.5 0 0 1 9.5 3h5A2.5 2.5 0 0 1 17 5.5V11" /><path d="M5 11h14v4H5zM7 15v6m10-6v6" /></>, p);
export const Users = (p: P) => base(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>, p);
export const Layers = (p: P) => base(<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />, p);
export const Check = (p: P) => base(<path d="m5 12.5 4.5 4.5L19 7.5" />, p);
export const ThumbsUp = (p: P) => base(<path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10H7Zm0 0 4-7a2.5 2.5 0 0 1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17.4 20H7" />, p);
export const Flag = (p: P) => base(<path d="M5 21V4m0 0h11l-2 4 2 4H5" />, p);
export const Shield = (p: P) => base(<><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" /><path d="M12 8v4m0 3.5v.01" /></>, p);
export const External = (p: P) => base(<path d="M14 4h6v6m0-6-9 9M19 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5H10" />, p);
export const Plus = (p: P) => base(<path d="M12 5v14M5 12h14" />, p);
export const Minus = (p: P) => base(<path d="M5 12h14" />, p);
export const X = (p: P) => base(<path d="M6 6l12 12M18 6 6 18" />, p);
export const Refresh = (p: P) => base(<path d="M20 11a8 8 0 0 0-14.7-4M4 4v4h4m-4 5a8 8 0 0 0 14.7 4M20 20v-4h-4" />, p);
export const Star = (p: P) => base(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />, p);
export const Sun = (p: P) => base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>, p);
export const Target = (p: P) => base(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>, p);
export const CornerTopRight = (p: P) => base(<path d="M6 6h12v12" />, p);
export const CornerBottomRight = (p: P) => base(<path d="M18 6v12H6" />, p);
export const Pin = (p: P) => base(<><path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>, p);
export const Building = (p: P) => base(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3" /></>, p);
