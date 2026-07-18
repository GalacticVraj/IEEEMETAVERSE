/**
 * Nominal ("branded") typing primitive.
 *
 * TypeScript is structurally typed, so a bare `string` node id is
 * interchangeable with any other `string`. Branding attaches a phantom,
 * compile-time-only tag so that `LineId` and `ZoneId` are NOT assignable to
 * each other even though both are strings at runtime. The brand symbol never
 * exists at runtime — it is erased entirely.
 *
 * @typeParam TValue - the underlying runtime type (e.g. `string`, `number`).
 * @typeParam TBrand - a unique string literal naming the brand.
 */
declare const __brand: unique symbol;

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly [__brand]: TBrand;
};
