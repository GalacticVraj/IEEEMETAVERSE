// Console-flow probe: Hero → Begin Shift → ScenarioPanel → Start Scenario →
// live ActiveCrisis console. Samples GridHealth values twice to prove the sim
// is ticking, captures screenshots, fails on any page error.
import { chromium } from 'playwright';

const url = process.env.PROBE_URL ?? 'http://localhost:5173';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 20000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'docs/superpowers/audit/console-01-hero.png' });

await page.getByRole('button', { name: 'Begin Shift' }).click({ timeout: 8000, force: true });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'docs/superpowers/audit/console-02-select.png' });

// Scenario select → start
await page.getByRole('button', { name: 'Start Scenario' }).click({ timeout: 8000, force: true });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'docs/superpowers/audit/console-03-crisis-early.png' });

const sample = async () => {
  const body = await page.textContent('body');
  const clock = body.match(/T\+(\d\d):(\d\d)/);
  const demand = body.match(/Demand\s*([\d,]+)\s*MW/);
  const gen = body.match(/Generation\s*([\d,]+)\s*MW/);
  return {
    clockSeconds: clock ? Number(clock[1]) * 60 + Number(clock[2]) : null,
    demand: demand ? Number(demand[1].replace(',', '')) : null,
    gen: gen ? Number(gen[1].replace(',', '')) : null,
  };
};

const s1 = await sample();
console.log('sample 1:', JSON.stringify(s1));
await page.waitForTimeout(5000);
const s2 = await sample();
console.log('sample 2:', JSON.stringify(s2));

await page.waitForTimeout(8000);
await page.screenshot({ path: 'docs/superpowers/audit/console-04-crisis-late.png' });

const alive =
  s1.clockSeconds !== null &&
  s2.clockSeconds !== null &&
  s2.clockSeconds > s1.clockSeconds &&
  (s2.gen ?? 0) > 0;
console.log('SIM ALIVE IN CONSOLE:', alive);
console.log('page errors:', errors.length ? errors.slice(0, 10) : 'none');

await browser.close();
process.exit(alive && errors.length === 0 ? 0 : 1);
