// Phase 1 verification probe — does the escalation ladder actually drive the UI?
//
// Walks the real flow to ActiveCrisis, then samples the command-bar crisis chip,
// the rail accent, banner text and the outage markers over time. Nothing here
// pokes app internals; it reads the rendered DOM, exactly what a judge sees.
//
//   node escalation-probe.mjs [--url=http://localhost:5173] [--seconds=300]
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const url = typeof args.url === 'string' ? args.url : 'http://localhost:5173';
const budgetS = Number(args.seconds ?? 300);
const outDir = 'docs/superpowers/audit/escalation';
mkdirSync(outDir, { recursive: true });

const errors = [];
// Small viewport on purpose: the headless software GPU is render-bound, and
// sim tick rate scales with pixels pushed. This is about reaching the scripted
// faults inside a sane wall-clock budget, not about pixel-perfect framing.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

const shot = async (name) => {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`  [shot] ${name}`);
};

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 20000 });
await page.waitForTimeout(2500);

// The hero CTA was renamed "Begin Shift" → "Start Training" when the second
// entry point ("Jump In") was added. Accept either so this harness keeps
// working across that change rather than failing on a label.
console.log('→ Start Training');
await page
  .getByRole('button', { name: /Start Training|Begin Shift/ })
  .first()
  .click({ timeout: 8000, force: true });
await page.waitForTimeout(11000); // 9.5 s intro flyover + settle

try {
  await page.getByRole('button', { name: 'Skip tutorial' }).click({ timeout: 5000, force: true });
  await page.waitForTimeout(1200);
} catch {
  /* already completed */
}

// Regex, not an exact name: the button reads "Start Scenario ▸", and
// getByRole's `name` matches the WHOLE accessible name by default.
console.log('→ Start Scenario');
await page
  .getByRole('button', { name: /Start Scenario/ })
  .first()
  .click({ timeout: 8000 });
await page.waitForTimeout(4000);
await shot('01-crisis-start');

// What the probe reads out of the live DOM each sample.
const sample = () =>
  page.evaluate(() => {
    const text = document.body.innerText;
    // The CommandBar's standing objective also contains "T+03:00", so matching
    // body text finds the OBJECTIVE and reports a clock frozen at 180 s. Read
    // the clock element itself: it is the only console-value that is nothing
    // but a timestamp.
    const clockEl = [...document.querySelectorAll('.console-value')].find((n) =>
      /^T\+\d\d:\d\d$/.test(n.textContent.trim()),
    );
    const clock = clockEl ? clockEl.textContent.trim().match(/T\+(\d\d):(\d\d)/) : null;
    const chip = ['STANDBY', 'NORMAL', 'WARNING', 'CRITICAL', 'BLACKOUT'].find((w) =>
      new RegExp(`●?\\s*${w}\\b`).test(text),
    );
    const banners = [...document.querySelectorAll('[role="status"]')].map((n) =>
      n.innerText.replace(/\s+/g, ' ').trim(),
    );
    // The rail accent is the escalation made structural.
    const rail = [...document.querySelectorAll('div')].find(
      (n) => n.style.borderLeft && /px solid/.test(n.style.borderLeft),
    );
    return {
      simSeconds: clock ? Number(clock[1]) * 60 + Number(clock[2]) : null,
      chip: chip ?? null,
      banners,
      railBorder: rail ? rail.style.borderLeft : null,
      vignette: document.querySelectorAll('.crisis-vignette').length,
      tripFlash: document.querySelectorAll('.trip-flash').length,
    };
  });

const timeline = [];
const seenChips = new Set();
const seenBanners = new Set();
let flashSeen = 0;
const started = Date.now();

while ((Date.now() - started) / 1000 < budgetS) {
  const s = await sample();
  s.wallS = Math.round((Date.now() - started) / 1000);
  timeline.push(s);
  if (s.chip) seenChips.add(s.chip);
  for (const b of s.banners) seenBanners.add(b);
  flashSeen += s.tripFlash;

  if (s.wallS % 30 === 0) {
    console.log(
      `  t=${s.wallS}s sim=T+${s.simSeconds}s chip=${s.chip} rail=${s.railBorder ?? '-'} banners=${s.banners.length} vignette=${s.vignette}`,
    );
  }
  // Sample fast enough to catch a 380 ms flash and a 4 s banner.
  await page.waitForTimeout(300);
}

await shot('02-crisis-late');

writeFileSync(
  `${outDir}/timeline.json`,
  JSON.stringify({ timeline, seenChips: [...seenChips], seenBanners: [...seenBanners], errors }, null, 2),
);

const last = timeline[timeline.length - 1];
console.log('\n──── RESULT ────');
console.log('sim reached      :', `T+${last.simSeconds}s`);
console.log('chip states seen :', [...seenChips].join(' → ') || 'none');
console.log('banners seen     :', seenBanners.size ? [...seenBanners].join(' | ') : 'none');
console.log('trip-flash frames:', flashSeen);
console.log('page errors      :', errors.length === 0 ? 'none' : JSON.stringify(errors.slice(0, 6)));
console.log('out dir          :', outDir);

await browser.close();
process.exit(errors.length === 0 ? 0 : 1);
