import { chromium } from 'playwright-core';
const [,, outPrefix = '/tmp/mc', ...script] = process.argv;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:8137/index.html' + (process.env.QS || ''));
await page.waitForFunction(() => window.__game, null, { timeout: 120000 }).catch(() => {});
await page.evaluate(() => { window.__paused = true; });
await page.waitForTimeout(300);
let n = 0;
for (const step of script) {
  // step forms: "tick:SECONDS", "click", "shot", "eval:JS"
  if (step.startsWith('tick:')) await page.evaluate((s) => window.__game.tick(s), parseFloat(step.slice(5)));
  else if (step === 'click') await page.evaluate(() => window.__game.click());
  else if (step.startsWith('view:')) { const a = step.slice(5).split(',').map(Number); await page.evaluate((a) => window.__game.view(a.slice(0,3), a.slice(3,6), a[6] || 60), a); }
  else if (step === 'shot') await page.screenshot({ path: `${outPrefix}_${n++}.png` });
  else if (step.startsWith('eval:')) console.log('eval ->', JSON.stringify(await page.evaluate(step.slice(5))));
}
console.log(logs.slice(0, 25).join('\n'));
await browser.close();
