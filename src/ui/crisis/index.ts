/**
 * `ui/crisis` — the escalation layer.
 *
 * One ladder (`crisis-level`), one hook that derives it from the live
 * projections (`use-crisis-level`), and the three surfaces that display it:
 * the command bar's colour (via the style table), the alert stack, and the
 * peripheral alarm. Every consumer reads the SAME assessment, so the console
 * can never disagree with itself about how much trouble the grid is in.
 */
export * from './crisis-level';
export * from './use-crisis-level';
export * from './banner-store';
export { CrisisBanners } from './CrisisBanner';
export { CrisisVignette } from './CrisisVignette';
export { TripFlash } from './TripFlash';
