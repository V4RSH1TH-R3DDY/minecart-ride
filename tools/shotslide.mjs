// usage: node tools/shotslide.mjs <slide> <out.png>   jumps straight to a slide and screenshots the card in its hall (server on :8137)
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:8137/index.html?scale=0.6&quality=low');
await page.waitForFunction(() => window.__game, null, { timeout: 200000 });
await page.evaluate(() => { window.__paused = true; });
await page.evaluate((n) => { const G = window.__game; G.goTo(n); G.tick(1.5, 1 / 60, true); }, Number(process.argv[2]));
await page.waitForTimeout(600);
await page.screenshot({ path: process.argv[3] });
console.log(logs.join('\n') || 'no errors');
await browser.close();
