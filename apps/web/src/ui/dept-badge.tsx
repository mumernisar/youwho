import { hueFor, hueStyle, initials } from './palette';

/** Round badge with a department's initials in its own stable hue. */
export function DeptBadge({ slug, label, size = 'md' }: { slug: string; label: string; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm';
  return (
    <span aria-hidden style={hueStyle(hueFor(slug))} className={`hue-soft hue-ink grid flex-none place-items-center rounded-xl font-bold ${dim}`}>
      {initials(label) || 'D'}
    </span>
  );
}
