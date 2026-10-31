# Scraper image for Render (free, 512 MB). Build context is the repo root:
#   docker build -t youwho-scraper .
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @youwho/scraper...
RUN pnpm --filter @youwho/scraper build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
# Only playwright and postgres are runtime dependencies; everything else is bundled into dist/main.js.
COPY --from=build /repo/apps/scraper/package.json ./full-package.json
RUN node -e "const p=require('./full-package.json');require('fs').writeFileSync('package.json',JSON.stringify({name:'youwho-scraper',private:true,type:'module',dependencies:p.dependencies}))" \
 && rm full-package.json \
 && npm install --omit=dev --ignore-scripts \
 && npx playwright install --only-shell --with-deps chromium \
 && rm -rf /var/lib/apt/lists/* /root/.npm
COPY --from=build /repo/apps/scraper/dist ./dist
EXPOSE 8080
CMD ["node", "--max-old-space-size=160", "dist/main.js"]
