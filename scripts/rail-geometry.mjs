// Rail geometry probe.
//
//   node scripts/rail-geometry.mjs [--url=http://localhost:5173]
//
// Measures the left rail at the viewport sizes that actually matter, and
// reports whether the scrollable region can show what is inside it. This
// exists because the rail has now been overflowed TWICE by well-meaning
// additions, and eyeballing a screenshot does not catch it — a panel below an
// invisible fold looks identical to a panel that is not there.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const url = typeof args.url === 'string' ? args.url : 'http://localhost:5173';
const outDir = 'docs/superpowers/audit/rail';
mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1600x900', width: 1600, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
];

const browser = await chromium.launch();
const report = [];

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(2500);

  await page
    .getByRole('button', { name: /Start Training|Begin Shift/ })
    .first()
    .click({ timeout: 8000, force: true });
  await page.waitForTimeout(11000); // intro flyover

  try {
    await page.getByRole('button', { name: 'Skip tutorial' }).click({ timeout: 4000, force: true });
    await page.waitForTimeout(1200);
  } catch {
    /* already completed */
  }

  const geometry = await page.evaluate(() => {
    const scroller = document.querySelector('.console-rail-scroll');
    const panels = [...document.querySelectorAll('.console-panel')].map((node) => ({
      label: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 42),
      height: Math.round(node.getBoundingClientRect().height),
      top: Math.round(node.getBoundingClientRect().top),
      bottom: Math.round(node.getBoundingClientRect().bottom),
    }));
    // Which buttons are actually reachable without scrolling?
    const buttons = [...document.querySelectorAll('button')]
      .map((node) => {
        const r = node.getBoundingClientRect();
        return {
          label: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 32),
          top: Math.round(r.top),
          visible: r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight,
        };
      })
      .filter((b) => b.label.length > 0);

    return {
      innerHeight: window.innerHeight,
      scroller:
        scroller === null
          ? null
          : {
              clientHeight: scroller.clientHeight,
              scrollHeight: scroller.scrollHeight,
              hidden: scroller.scrollHeight - scroller.clientHeight,
            },
      panels,
      buttons,
    };
  });

  report.push({ viewport: viewport.label, errors, ...geometry });

  await page.screenshot({ path: `${outDir}/${viewport.label}.png` });
  console.log(`\n──── ${viewport.label} ────`);
  if (geometry.scroller === null) {
    console.log('  rail scroller: NOT FOUND');
  } else {
    const { clientHeight, scrollHeight, hidden } = geometry.scroller;
    console.log(`  rail scroller: ${clientHeight}px visible of ${scrollHeight}px content`);
    console.log(`  hidden below the fold: ${hidden}px ${hidden > 0 ? '  <-- OVERFLOW' : '(ok)'}`);
  }
  for (const panel of geometry.panels) {
    console.log(`   panel ${String(panel.height).padStart(4)}px  ${panel.label}`);
  }
  const offscreen = geometry.buttons.filter((b) => !b.visible);
  if (offscreen.length > 0) {
    console.log(`  buttons NOT fully on screen: ${offscreen.map((b) => b.label).join(' | ')}`);
  }
  if (errors.length > 0) console.log(`  page errors: ${JSON.stringify(errors.slice(0, 3))}`);

  await page.close();
}

writeFileSync(`${outDir}/geometry.json`, JSON.stringify(report, null, 2));
console.log(`\nwrote ${outDir}/geometry.json`);
await browser.close();
