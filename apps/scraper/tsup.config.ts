import { defineConfig } from 'tsup';

// One file. Workspace packages and pure-JS libraries are bundled; only playwright and postgres stay
// as runtime dependencies in the image.
export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  noExternal: [/^@youwho\//, 'drizzle-orm', 'zod', 'pino', 'acorn'],
  external: ['playwright', 'postgres', '@neondatabase/serverless'],
  // Bundled CommonJS code (pino) calls require() for Node built-ins.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
