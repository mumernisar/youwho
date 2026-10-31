import { fail } from '@youwho/errors';

const REG_RE = /^([A-Z]{2})-?(\d{2})-?([A-Z]{3})-?(\d{1,3})$/;

/** FA24-BSE-058 from "fa24bse58", "CIIT/FA24-BSE-58/ISB", etc. Null when it is not a reg number. */
export function normalizeReg(input: string): string | null {
  const x = input.toUpperCase().replace('CIIT/', '').replace('/ISB', '').replace(/\s+/g, '');
  const m = REG_RE.exec(x);
  return m ? `${m[1]}${m[2]}-${m[3]}-${m[4]!.padStart(3, '0')}` : null;
}

export function parseReg(input: string): string {
  return normalizeReg(input) ?? fail('INVALID_REG_NUMBER');
}
