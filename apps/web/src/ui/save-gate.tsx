'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { isStandalone } from '@/client/app-mode';
import { OFFLINE_ENABLED } from '../site-status';

// Loaded only inside the installed app, so a browser tab downloads none of the saving code.
const SavePapers = dynamic(() => import('./save-papers').then((m) => m.SavePapers), { ssr: false });

export function SaveGate({ reg }: { reg: string }) {
  const [app, setApp] = useState(false);
  useEffect(() => setApp(OFFLINE_ENABLED && isStandalone()), []);
  return app ? <SavePapers reg={reg} /> : null;
}
