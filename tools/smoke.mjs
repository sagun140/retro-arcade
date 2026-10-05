// Headless smoke test: node tools/smoke.mjs <appId> [screenshot.png] [--eval "js run in page after open"] [--wait ms]
// Opens index.html in headless Chrome, opens the app window, reports console errors, saves a screenshot.
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HOME + '/.hermes/hermes-agent/node_modules/playwright-core');
const args = process.argv.slice(2);
const id = args[0], shot = args[1] && !args[1].startsWith('--') ? args[1] : null;
const evalIdx = args.indexOf('--eval'), waitIdx = args.indexOf('--wait');
const code = evalIdx > -1 ? args[evalIdx + 1] : null, wait = waitIdx > -1 ? +args[waitIdx + 1] : 800;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', m => { const x = m.text(); if (!x.includes('net::ERR_FAILED') && (m.type() === 'error' || m.type() === 'warning')) errors.push('[' + m.type() + '] ' + x); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), '../index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(300);
if (id) await page.evaluate(i => { Arcade.closeAll(); Arcade.open(i); }, id);
await page.waitForTimeout(300);
if (code) { const r = await page.evaluate(code); if (r !== undefined) console.log('eval →', JSON.stringify(r)); }
await page.waitForTimeout(wait);
if (shot) await page.screenshot({ path: shot });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
