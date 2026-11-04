import type { Metadata } from 'next';
import { SavedView } from '@/ui/saved-view';

/**
 * The offline page. The service worker answers /r/{REG} with this page for numbers saved on the
 * phone, and any page that cannot load offline. It has no server data; everything comes from the phone.
 */
export const metadata: Metadata = { title: 'Your papers', robots: { index: false } };

export default function Saved() {
  return <SavedView />;
}
