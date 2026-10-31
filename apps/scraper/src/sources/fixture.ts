import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fail } from '@youwho/errors';
import { sleep, type PageRead, type PageSource, type ReadStage } from './types';

/**
 * Reads the sample files from disk so the whole pipeline runs without a browser. The last part of
 * the URL picks a behaviour for hand-checking the error paths:
 *   missing-* → SOURCE_NO_DATA, private-* → SOURCE_NOT_PUBLIC, broken-* → unreadable data,
 *   unreachable-* → SOURCE_UNREACHABLE, slow-* → waits FIXTURE_DELAY_MS (15 s if unset) first.
 * Anything else returns the sample straight away.
 */
export class FixturePageSource implements PageSource {
  constructor(private readonly opts: { dir: string; delayMs: number }) {}

  async read(url: string, signal: AbortSignal, onStage?: (stage: ReadStage) => void): Promise<PageRead> {
    onStage?.('opening');
    const last = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
    if (last.startsWith('slow')) await sleep(this.opts.delayMs || 15_000, signal);
    if (last.startsWith('unreachable')) return fail('SOURCE_UNREACHABLE');
    if (last.startsWith('private')) return fail('SOURCE_NOT_PUBLIC');
    onStage?.('extracting');
    if (last.startsWith('missing')) return fail('SOURCE_NO_DATA');
    const [dataText, logicText] = await Promise.all([
      readFile(path.join(this.opts.dir, 'cs-fa26-mid.json'), 'utf8'),
      readFile(path.join(this.opts.dir, 'cs-fa26-mid.logic.js'), 'utf8'),
    ]);
    return { dataText: last.startsWith('broken') ? dataText.slice(0, 200) : dataText, logicText, title: 'CS Mid Term FA26 Students' };
  }
}
