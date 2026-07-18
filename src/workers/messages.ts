/**
 * Typed message contract between the main thread and a future simulation web
 * worker. Defining this now lets the rest of the app talk to a bridge whose
 * implementation can move to a worker later without changing callers.
 */
export type WorkerRequest =
  | { readonly type: 'boot'; readonly seed: number }
  | { readonly type: 'tick'; readonly count: number }
  | { readonly type: 'dispose' };

export type WorkerResponse =
  | { readonly type: 'booted' }
  | { readonly type: 'tick-complete'; readonly tick: number }
  | { readonly type: 'error'; readonly message: string };
