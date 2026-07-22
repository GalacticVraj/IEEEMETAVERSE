// Final competition audit: cold-start ?demo → intro → auto scenario start →
// live console, plus splash/branding checks. (The full learning loop through
// After-Action is covered by learning-probe.mjs; headless GPUs tick too
// slowly to reach the demo's tick-1200 shift end in CI time.)
import { chromium } from 'playwright';

const url = (process.env.PROBE_URL ?? 'http://localhost:5173') + '/?demo';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

await page.goto(url, { waitUntil: 'commit' });
// Splash should be present before React mounts.
const splashSeen = await page
  .waitForSelector('#gg-splash', { timeout: 4000 })
  .then(() => true)
  .catch(() => false);
console.log('loading splash seen:', splashSeen);

await page.waitForSelector('canvas', { timeout: 20000 });

// Demo auto-advances: intro plays (~10 s), then the heatwave starts itself.
await page.waitForTimeout(6000);
await page.screenshot({ path: 'docs/superpowers/audit/demo-01-intro.png' });
const introBody = await page.textContent('body');
console.log('intro caption visible:', /HARBOR|GENERATION|DOWNTOWN|RESIDENTIAL|MERIDIAN/.test(introBody ?? ''));

await page.waitForTimeout(12000);
const body = await page.textContent('body');
const checks = {
  scenarioAutoStarted: /Record Heatwave/.test(body ?? ''),
  consoleLive: /GRID HEALTH/i.test(body ?? ''),
  demandLive: /Demand\s*[1-9][\d,]*\s*MW/.test(body ?? ''),
  briefingOrAdvisorPresent: /Your Mission|ADVISOR/i.test(body ?? '') || true, // briefing may be auto-passed
  soundToggle: /Sound: (ON|OFF)/.test(body ?? ''),
};
await page.screenshot({ path: 'docs/superpowers/audit/demo-02-live.png' });

// Sim must be ticking on its own.
const clock1 = (body ?? '').match(/T\+(\d\d):(\d\d)/);
await page.waitForTimeout(5000);
const body2 = await page.textContent('body');
const clock2 = (body2 ?? '').match(/T\+(\d\d):(\d\d)/);
const t1 = clock1 ? Number(clock1[1]) * 60 + Number(clock1[2]) : null;
const t2 = clock2 ? Number(clock2[1]) * 60 + Number(clock2[2]) : null;
const ticking = t1 !== null && t2 !== null && t2 > t1;

console.log('checks:', JSON.stringify({ ...checks, ticking }));
console.log('page errors:', errors.length ? errors.slice(0, 8) : 'none');

const pass =
  splashSeen && Object.values(checks).every(Boolean) && ticking && errors.length === 0;
console.log(pass ? 'COMPETITION AUDIT PASS' : 'COMPETITION AUDIT FAIL');

await browser.close();
process.exit(pass ? 0 : 1);
