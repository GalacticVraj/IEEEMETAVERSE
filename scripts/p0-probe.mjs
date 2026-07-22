// P0 gate probe: does localhost run a LIVE simulation end-to-end?
// Walks the current (pre-redesign) flow:
// Hero "Enter City" → Arrival "Skip sequence" → Explore (20 s gate) "Enter Simulation"
// → Briefing "Next >"×N "Start Crisis" → CrisisSelect heatwave card → sample telemetry.
import { chromium } from 'playwright';

const url = process.env.PROBE_URL ?? 'http://localhost:5173';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

const click = async (name, timeout = 5000) => {
  const btn = page.getByRole('button', { name, exact: false }).first();
  await btn.click({ timeout, force: true });
  console.log(`clicked: ${name}`);
};

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 20000 });
await page.waitForTimeout(2500);

await click('Enter City');
await page.waitForTimeout(1500);
await click('Skip sequence');

// Explore gate: the Enter Simulation button appears after ~20 s.
console.log('waiting out the explore gate…');
await page
  .getByRole('button', { name: 'Enter Simulation' })
  .click({ timeout: 30000, force: true });
console.log('clicked: Enter Simulation');
await page.waitForTimeout(1000);

// Briefing: advance dialogue until Start Crisis appears.
for (let i = 0; i < 12; i++) {
  const start = page.getByRole('button', { name: 'Start Crisis' });
  if (await start.count()) {
    await start.click({ force: true });
    console.log('clicked: Start Crisis');
    break;
  }
  const next = page.getByRole('button', { name: /Next|Skip/ }).first();
  if (await next.count()) await next.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
}
await page.waitForTimeout(1000);

console.log('crisis select visible:', !!(await page.getByText('Choose Your Crisis').count()));
await page.screenshot({ path: 'docs/superpowers/audit/p0-crisis-select.png' });

await page
  .getByRole('button')
  .filter({ hasText: 'Heatwave' })
  .first()
  .click({ timeout: 5000, force: true });
console.log('clicked heatwave card');
await page.waitForTimeout(3000);

const sample = async () => {
  const body = await page.textContent('body');
  const tickMatch = body.match(/Tick\s*(\d+)/);
  const load = body.match(/Total Load\s*([\d.]+)\s*MW/);
  const gen = body.match(/Total Gen\s*([\d.]+)\s*MW/);
  return {
    tick: tickMatch ? Number(tickMatch[1]) : null,
    load: load ? Number(load[1]) : null,
    gen: gen ? Number(gen[1]) : null,
  };
};

const s1 = await sample();
console.log('sample 1:', JSON.stringify(s1));
await page.waitForTimeout(4000);
const s2 = await sample();
console.log('sample 2:', JSON.stringify(s2));
await page.screenshot({ path: 'docs/superpowers/audit/p0-active-crisis.png' });

const alive =
  s1.tick !== null && s2.tick !== null && s2.tick > s1.tick && (s2.gen ?? 0) > 0;
console.log('SIM ALIVE:', alive);
console.log('page errors:', errors.length ? errors.slice(0, 10) : 'none');

await browser.close();
process.exit(alive && errors.length === 0 ? 0 : 1);
