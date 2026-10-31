export interface PageRead {
  dataText: string;
  logicText: string;
  title: string;
}

/** Stage names the runner records; the web UI turns them into text. */
export type ReadStage = 'opening' | 'extracting';

export interface PageSource {
  read(url: string, signal: AbortSignal, onStage?: (stage: ReadStage) => void): Promise<PageRead>;
}

/** Resolves after `ms`, or rejects with the signal's reason as soon as it aborts. */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
