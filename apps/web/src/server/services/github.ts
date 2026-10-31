import 'server-only';
import type { Logger } from '@youwho/config';

const TTL_MS = 3600_000; // 1 hour
const RETRY_MS = 300_000; // after a failure, try again in 5 minutes

/** Star count from the GitHub API, cached per server instance. Null when GitHub is unreachable. */
export class GithubService {
  private cache: { stars: number | null; until: number } | null = null;

  constructor(private readonly deps: { repo: string; token: string | undefined; log: Logger; now(): Date }) {}

  get url(): string {
    return `https://github.com/${this.deps.repo}`;
  }

  async stars(): Promise<number | null> {
    const t = this.deps.now().getTime();
    if (this.cache && this.cache.until > t) return this.cache.stars;
    let stars: number | null = null;
    try {
      const res = await fetch(`https://api.github.com/repos/${this.deps.repo}`, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'youwho', ...(this.deps.token ? { authorization: `Bearer ${this.deps.token}` } : {}) },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new TypeError(`GitHub answered ${res.status}`);
      const body = (await res.json()) as { stargazers_count?: unknown };
      stars = typeof body.stargazers_count === 'number' ? body.stargazers_count : null;
    } catch (err) {
      this.deps.log.warn({ err }, 'could not read the GitHub star count');
    }
    this.cache = { stars, until: t + (stars === null ? RETRY_MS : TTL_MS) };
    return stars;
  }
}
