// Renders src/assets/og-default.png, the link-preview image:
//   node scripts/generate-og-image.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const font = (file) => `data:font/woff2;base64,${readFileSync(new URL(`src/assets/fonts/${file}`, ROOT)).toString('base64')}`;
const keys = Array.from({ length: 36 }, (_, i) => i);
const black = (i) => [1, 3, 6, 8, 10].includes(i % 12);
const html = `<!doctype html><html><head><style>
@font-face { font-family: Display; src: url(${font('cormorant-garamond-latin-500-italic.woff2')}); font-style: italic; }
@font-face { font-family: Text; src: url(${font('eb-garamond-latin-400-normal.woff2')}); }
html, body { margin: 0; }
body { width: 1200px; height: 630px; background: #f8f4ea; color: #1c1813; display: grid; place-items: center; font-family: Text; }
.card { text-align: center; }
.label { font-variant-caps: all-small-caps; font-feature-settings: 'smcp', 'c2sc'; letter-spacing: .18em; color: #7d5f1c; font-size: 30px; }
h1 { font-family: Display; font-style: italic; font-weight: 500; font-size: 150px; margin: 6px 0 4px; line-height: 1; }
.tag { font-size: 34px; font-style: italic; color: #665b4d; margin: 0 0 40px; }
.rule { width: 520px; height: 1px; background: rgba(28,24,19,.25); margin: 0 auto 40px; position: relative; }
.rule::after { content: ''; position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; background: #7d5f1c; transform: translate(-50%,-50%) rotate(45deg); }
.kbd { display: inline-flex; padding: 14px 18px 0; background: #101010; border-radius: 8px; height: 120px; }
.w { width: 30px; height: 100%; background: linear-gradient(#fbfaf7 70%, #e9dcb8); margin-right: 2px; border-radius: 0 0 3px 3px; }
.b { width: 18px; height: 62%; background: #222; margin: 0 -10px; z-index: 1; border-radius: 0 0 2px 2px; }
</style></head><body><div class="card">
<div class="label">Classical piano over the ages</div><h1>Pianoforte</h1>
<p class="tag">From Bach to Marc-André Hamelin</p><div class="rule"></div>
<div class="kbd">${keys.map((i) => `<div class="${black(i) ? 'b' : 'w'}"></div>`).join('')}</div>
</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: fileURLToPath(new URL('src/assets/og-default.png', ROOT)) });
await browser.close();
