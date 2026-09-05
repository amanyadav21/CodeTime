// Bundles the extension (src/) and copies the webview static export into dist/webview/.
// Run: `node esbuild.config.mjs` or `node esbuild.config.mjs --watch`.

import { build, context } from 'esbuild';
import { mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const outdir = resolve(__dirname, 'dist');
const webviewOut = resolve(__dirname, 'webview', 'out');
const targetWebviewDir = resolve(outdir, 'webview');

async function copyWebview() {
  if (!existsSync(webviewOut)) {
    console.warn('[esbuild] webview/out not found. Run `npm run build:webview` first.');
    return;
  }
  await rm(targetWebviewDir, { recursive: true, force: true });
  await cp(webviewOut, targetWebviewDir, { recursive: true });
  info('[esbuild] copied webview/out -> dist/webview');
}

const extensionConfig = {
  entryPoints: [resolve(__dirname, 'src/extension.ts')],
  outfile: resolve(outdir, 'extension.js'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  logLevel: 'info',
  // Engine files must not pull `vscode` at runtime; ensure externals are correct.
  // We mark nothing else external — bundling is desired.
};

// eslint-disable-next-line no-console
const info = (msg) => console.log(msg);

async function run() {
  await mkdir(outdir, { recursive: true });
  await copyWebview();
  if (watch) {
    const ctx = await context(extensionConfig);
    await ctx.watch();
    info('[esbuild] watching...');
  } else {
    await build(extensionConfig);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
