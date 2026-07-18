/**
 * Pure, deterministic graph algorithms over string-branded node ids. They
 * perform NO electrical calculation — only topology traversal. Determinism is
 * guaranteed by sorting nodes and neighbor lists, so results never depend on
 * insertion order.
 */

export interface GraphEdgeRef<TNode extends string> {
  readonly id: string;
  readonly from: TNode;
  readonly to: TNode;
}

/**
 * Build an undirected adjacency map with sorted neighbor lists. Self-loops
 * (`from === to`) connect nothing and are skipped; edges referencing unknown
 * nodes are ignored (the validator reports those separately).
 */
export function buildAdjacency<TNode extends string>(
  nodes: readonly TNode[],
  edges: readonly GraphEdgeRef<TNode>[],
): Map<TNode, TNode[]> {
  const sets = new Map<TNode, Set<TNode>>();
  for (const node of nodes) {
    sets.set(node, new Set<TNode>());
  }
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    sets.get(edge.from)?.add(edge.to);
    sets.get(edge.to)?.add(edge.from);
  }
  const adjacency = new Map<TNode, TNode[]>();
  for (const [node, neighbors] of sets) {
    adjacency.set(node, [...neighbors].sort());
  }
  return adjacency;
}

/** All nodes reachable from `start` via a breadth-first traversal. */
export function reachableFrom<TNode extends string>(
  start: TNode,
  adjacency: ReadonlyMap<TNode, readonly TNode[]>,
): Set<TNode> {
  const visited = new Set<TNode>([start]);
  const queue: TNode[] = [start];
  while (queue.length > 0) {
    const node = queue.shift() as TNode;
    for (const neighbor of adjacency.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

/**
 * Connected components (electrical islands): each component is sorted, and
 * components are ordered by their smallest node id — fully deterministic.
 */
export function connectedComponents<TNode extends string>(
  nodes: readonly TNode[],
  edges: readonly GraphEdgeRef<TNode>[],
): TNode[][] {
  const adjacency = buildAdjacency(nodes, edges);
  const ordered = [...nodes].sort();
  const visited = new Set<TNode>();
  const components: TNode[][] = [];
  for (const start of ordered) {
    if (visited.has(start)) continue;
    const component = [...reachableFrom(start, adjacency)];
    for (const node of component) {
      visited.add(node);
    }
    components.push(component.sort());
  }
  return components;
}

/**
 * The shortest node path from `from` to `to` (BFS), or `null` if unreachable.
 * Deterministic: sorted neighbor order makes the chosen path stable when
 * several equal-length paths exist.
 */
export function shortestPath<TNode extends string>(
  from: TNode,
  to: TNode,
  adjacency: ReadonlyMap<TNode, readonly TNode[]>,
): TNode[] | null {
  if (from === to) return [from];
  const visited = new Set<TNode>([from]);
  const parent = new Map<TNode, TNode>();
  const queue: TNode[] = [from];
  while (queue.length > 0) {
    const node = queue.shift() as TNode;
    for (const neighbor of adjacency.get(node) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, node);
      if (neighbor === to) {
        const path: TNode[] = [to];
        let cursor: TNode = to;
        while (cursor !== from) {
          const previous = parent.get(cursor);
          if (previous === undefined) return null;
          path.push(previous);
          cursor = previous;
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }
  return null;
}
