'use client';

import { useEffect, useState } from 'react';
import type { JobView } from '@/server/schemas';
import { apiFetch, ClientError } from './api-fetch';

const POLL_MS = 2000;

/** Polls a job every 2 seconds while it is active and stops on done or failed. */
export function useJob(id: string | null): { job: JobView | null; pollError: ClientError | null } {
  const [job, setJob] = useState<JobView | null>(null);
  const [pollError, setPollError] = useState<ClientError | null>(null);

  useEffect(() => {
    setJob(null);
    setPollError(null);
    if (!id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next = await apiFetch<JobView>(`/api/jobs/${id}`);
        if (stopped) return;
        setJob(next);
        setPollError(null);
        if (next.status === 'done' || next.status === 'failed') return;
      } catch (e) {
        if (stopped) return;
        if (e instanceof ClientError && e.code === 'JOB_NOT_FOUND') return void setPollError(e);
        setPollError(e instanceof ClientError ? e : null);
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  return { job, pollError };
}

/** Re-renders every second, for the elapsed timer. */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}
