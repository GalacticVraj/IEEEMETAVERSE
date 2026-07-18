import type { GraphDiagnostics } from './graph-model';

/**
 * Format graph diagnostics as a single console line (no UI). Intended for
 * developer logging: `logger.info(formatGraphDiagnostics(graph.diagnostics()))`.
 */
export function formatGraphDiagnostics(diagnostics: GraphDiagnostics): string {
  return [
    `graph v${diagnostics.version} hash=${diagnostics.hash}`,
    `nodes=${diagnostics.nodeCount} edges=${diagnostics.edgeCount} islands=${diagnostics.islandCount}`,
    `gen=${diagnostics.generatorCount} load=${diagnostics.loadCount} sub=${diagnostics.substationCount} brk=${diagnostics.breakerCount}`,
    `validation=${diagnostics.validationPassed ? 'PASS' : 'FAIL'}`,
  ].join(' | ');
}
