// §4 probe: full learning loop — start crisis, execute a real intervention,
// let the evidence window mature, end the shift, verify the after-action
// review renders measured data. Fails on any page error.
import { chromium } from 'playwright';

const url = process.env.PROBE_URL ?? 'http://localhost:5173';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 20000 });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: 'Begin Shift' }).click({ force: true, timeout: 8000 });
await page.waitForTimeout(2000);
const skip = page.getByRole('button', { name: 'Skip intro' });
if (await skip.count()) await skip.click({ force: true });
await page.waitForTimeout(1500);

await page.getByRole('button', { name: 'Start Scenario' }).click({ force: true, timeout: 8000 });
console.log('scenario started');
await page.waitForTimeout(15000);

// Execute the first standing operator action → real DecisionCommitted.
await page.getByRole('button', { name: 'Execute' }).first().click({ force: true, timeout: 8000 });
console.log('executed operator action');

// Let the evidence window mature (50 sim ticks; headless ticks are slow).
await page.waitForTimeout(45000);
await page.screenshot({ path: 'docs/superpowers/audit/learning-01-inplay.png' });

const bodyDuring = await page.textContent('body');
console.log('advisor visible during play:', /ADVISOR/.test(bodyDuring ?? ''));
console.log('action committed:', /COMMITTED/.test(bodyDuring ?? ''));

// End the shift → after-action review.
await page.getByRole('button', { name: 'End Shift' }).click({ force: true, timeout: 8000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'docs/superpowers/audit/learning-02-after-action.png', fullPage: false });

const body = await page.textContent('body');
const checks = {
  review: /After-Action Review/.test(body ?? ''),
  debrief: /Mission Debrief/.test(body ?? ''),
  scores: /Overall Mission Rating/.test(body ?? ''),
  decisions: /Decision Analysis/.test(body ?? ''),
  mastery: /Concept Mastery/.test(body ?? ''),
  timeline: /Run Timeline/.test(body ?? ''),
  measured: /stress \d+ %/.test(body ?? ''),
};
console.log('after-action checks:', JSON.stringify(checks));

const pass = Object.values(checks).every(Boolean) && errors.length === 0;
console.log('page errors:', errors.length ? errors.slice(0, 8) : 'none');
console.log(pass ? 'LEARNING PROBE PASS' : 'LEARNING PROBE FAIL');

await browser.close();
process.exit(pass ? 0 : 1);
