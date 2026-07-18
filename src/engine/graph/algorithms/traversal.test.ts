import { asBusId } from '@app-types';
import type { BusId } from '@app-types';
import { describe, expect, it } from 'vitest';

import { buildAdjacency, connectedComponents, reachableFrom, shortestPath } from './traversal';

const b = (name: string): BusId => asBusId(name);
const edge = (id: string, from: string, to: string) => ({ id, from: b(from), to: b(to) });

describe('buildAdjacency', () => {
  it('is undirected and sorts neighbors deterministically', () => {
    const nodes = [b('a'), b('b'), b('c')];
    const edges = [edge('e1', 'a', 'c'), edge('e2', 'a', 'b')];
    const adjacency = buildAdjacency(nodes, edges);
    expect(adjacency.get(b('a'))).toEqual([b('b'), b('c')]);
    expect(adjacency.get(b('b'))).toEqual([b('a')]);
    expect(adjacency.get(b('c'))).toEqual([b('a')]);
  });
});

describe('connectedComponents', () => {
  it('finds separate islands', () => {
    const nodes = [b('a'), b('b'), b('c'), b('d')];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'c', 'd')];
    const components = connectedComponents(nodes, edges);
    expect(components).toEqual([
      [b('a'), b('b')],
      [b('c'), b('d')],
    ]);
  });

  it('treats an isolated node as its own component', () => {
    const components = connectedComponents([b('x'), b('y')], [edge('e', 'x', 'x')]);
    // self-loop keeps x connected only to itself; y is isolated.
    expect(components).toEqual([[b('x')], [b('y')]]);
  });

  it('collapses a fully-connected graph into one component', () => {
    const nodes = [b('a'), b('b'), b('c')];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];
    expect(connectedComponents(nodes, edges)).toEqual([[b('a'), b('b'), b('c')]]);
  });

  it('is deterministic across identical inputs', () => {
    const nodes = [b('d'), b('a'), b('c'), b('b')];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'c', 'd')];
    expect(connectedComponents(nodes, edges)).toEqual(connectedComponents(nodes, edges));
  });
});

describe('reachableFrom', () => {
  it('returns all nodes reachable from a start', () => {
    const adjacency = buildAdjacency(
      [b('a'), b('b'), b('c'), b('d')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    );
    const reachable = reachableFrom(b('a'), adjacency);
    expect([...reachable].sort()).toEqual([b('a'), b('b'), b('c')]);
    expect(reachable.has(b('d'))).toBe(false);
  });
});

describe('shortestPath', () => {
  it('finds the shortest path between two nodes', () => {
    const adjacency = buildAdjacency(
      [b('a'), b('b'), b('c'), b('d')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'd'), edge('e3', 'a', 'c'), edge('e4', 'c', 'd')],
    );
    const path = shortestPath(b('a'), b('d'), adjacency);
    expect(path).not.toBeNull();
    expect(path?.length).toBe(3);
    expect(path?.[0]).toBe(b('a'));
    expect(path?.[path.length - 1]).toBe(b('d'));
  });

  it('returns the single-node path for start === goal', () => {
    const adjacency = buildAdjacency([b('a')], []);
    expect(shortestPath(b('a'), b('a'), adjacency)).toEqual([b('a')]);
  });

  it('returns null when unreachable', () => {
    const adjacency = buildAdjacency([b('a'), b('b')], []);
    expect(shortestPath(b('a'), b('b'), adjacency)).toBeNull();
  });
});
