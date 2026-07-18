import type { WorkerRequest, WorkerResponse } from './messages';

/**
 * PLACEHOLDER simulation worker entry point.
 *
 * A later phase will host a `SimulationKernel` here and drive it from
 * `WorkerRequest` messages, posting `WorkerResponse` back. It is kept free of
 * `self`/`postMessage` for now so it typechecks cleanly and documents the
 * contract without committing to the worker runtime yet.
 */
export function handleWorkerRequest(request: WorkerRequest): WorkerResponse {
  return {
    type: 'error',
    message: `Worker offload not implemented yet for request: ${request.type}`,
  };
}
