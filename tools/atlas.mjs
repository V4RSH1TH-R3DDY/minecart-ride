import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:8137/index.html');
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
const url = await page.evaluate(() => { let u; window.__game.scene.traverse((o) => { if (!u && o.isMesh && o.material.map && o.material.map.image && o.material.map.image.toDataURL) u = o.material.map.image.toDataURL(); }); return u; });
fs.writeFileSync('/tmp/atlas.png', Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
