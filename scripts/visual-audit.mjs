// GridGuard visual audit harness.
//
//   node scripts/visual-audit.mjs [--label=after] [--url=http://localhost:5173]
//
// Walks the real operator flow (Hero → Begin Shift → Start Scenario → crisis),
// screenshots each state into docs/superpowers/audit/<label>/, waits deep into
// the crisis so scripted faults (heatwave baseload trip @ tick 60) land, and
// writes console-errors.json. Exits non-zero on any page error.
//
// NOTE: headless rendering uses a software GPU — sim ticks run slower than
// real-time there. The waits below are sized for that.
import { mkdirSync } from 'node:fs';
import { writeFileSync } from 'node:fs';

import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const label = typeof args.label === 'string' ? args.label : 'after';
const url = typeof args.url === 'string' ? args.url : 'http://localhost:5173';
const outDir = `docs/superpowers/audit/${label}`;
mkdirSync(outDir, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

const shot = async (name) => {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`captured ${name}`);
};

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 20000 });
await page.waitForTimeout(3500); // scene settle
await shot('01-hero');

// Hero → CrisisSelect (best-effort: button may differ across revisions)
try {
  await page.getByRole('button', { name: 'Begin Shift' }).click({ timeout: 8000, force: true });
} catch {
  await page.getByRole('button', { name: /Enter|Start|Begin/ }).first().click({ timeout: 8000, force: true });
}
await page.waitForTimeout(1500);
await shot('02-crisis-select');

// Start the selected (default heatwave) scenario
try {
  await page.getByRole('button', { name: 'Start Scenario' }).click({ timeout: 8000, force: true });
} catch {
  await page.locator('[data-scenario]').first().click({ timeout: 8000, force: true });
  await page.getByRole('button', { name: 'Start Scenario' }).click({ timeout: 8000, force: true });
}
await page.waitForTimeout(6000);
await shot('03-crisis-early');

// Sample live telemetry to prove the sim ticks
const sample = async () => {
  const body = await page.textContent('body');
  const clock = body.match(/T\+(\d\d):(\d\d)/);
  const gen = body.match(/Generation\s*([\d,]+)\s*MW/);
  return {
    clockSeconds: clock ? Number(clock[1]) * 60 + Number(clock[2]) : null,
    gen: gen ? Number(gen[1].replace(',', '')) : null,
  };
};
const s1 = await sample();
await page.waitForTimeout(5000);
const s2 = await sample();
const alive = s1.clockSeconds !== null && s2.clockSeconds > s1.clockSeconds && (s2.gen ?? 0) > 0;
console.log(`tick advance ${s1.clockSeconds}s → ${s2.clockSeconds}s, gen ${s2.gen} MW, alive=${alive}`);

// Deep crisis: wait for scripted faults + protection + director activity
await page.waitForTimeout(75_000);
await shot('04-crisis-deep');

// Late crisis / event-rich timeline
await page.waitForTimeout(45_000);
await shot('05-crisis-late');

writeFileSync(`${outDir}/console-errors.json`, JSON.stringify(errors, null, 2));
console.log(`page errors: ${errors.length === 0 ? 'none' : JSON.stringify(errors.slice(0, 10))}`);
console.log(alive && errors.length === 0 ? 'AUDIT PASS' : 'AUDIT FAIL');

await browser.close();
process.exit(alive && errors.length === 0 ? 0 : 1);
