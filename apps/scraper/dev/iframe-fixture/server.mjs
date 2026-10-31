// Development aid, not a test: three nested iframes across two origins, with the data in the
// innermost one, to develop the Playwright source's frame walking without hitting Google.
//   :4101 top page → iframe :4102/a → iframe :4101/b → iframe :4102/c (script#data lives here)
// Run it, add a job for http://localhost:4101/ with DEV_ALLOW_LOCALHOST=true PAGE_SOURCE=playwright.
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const fixtures = fileURLToPath(new URL('../../../../packages/core/fixtures/', import.meta.url));
const data = readFileSync(fixtures + 'cs-fa26-mid.json', 'utf8');
const logic = readFileSync(fixtures + 'cs-fa26-mid.logic.js', 'utf8');
// A closing script tag inside the JSON would end the element early; the sample has none.
const page = (body) => `<!doctype html><title>Nested fixture</title><body>${body}</body>`;

const routes = {
  '/': page('<iframe src="http://localhost:4102/a" width="600" height="400"></iframe>'),
  '/a': page('<iframe src="http://localhost:4101/b" width="500" height="300"></iframe>'),
  '/b': page('<iframe src="http://localhost:4102/c" width="400" height="200"></iframe>'),
  '/c': page(`<script type="application/json" id="data">${data}</script><script>${logic}</script>`),
};

for (const port of [4101, 4102]) {
  http
    .createServer((req, res) => {
      const body = routes[req.url?.split('?')[0] ?? '/'];
      res.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body ?? 'not found');
    })
    .listen(port, () => console.log(`iframe fixture on http://localhost:${port}`));
}
