import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { NUMBER_SPIRAL, TERRAIN_DISTRIBUTION, createBoard, RESOURCES } from "@/game";

describe("board generation", () => {
  test("creates the complete base board graph", () => {
    const { board } = createBoard(2025);
    expect(board.tiles).toHaveLength(19);
    expect(board.vertices).toHaveLength(54);
    expect(board.edges).toHaveLength(72);
    expect(board.ports).toHaveLength(9);
    expect(board.tiles.filter((tile) => tile.terrain === "desert")).toHaveLength(1);
    expect(board.robberTileId).toBe(board.tiles.find((tile) => tile.terrain === "desert")!.id);
    for (const resource of RESOURCES) {
      expect(board.tiles.filter((tile) => tile.terrain === resource)).toHaveLength(TERRAIN_DISTRIBUTION.filter((terrain) => terrain === resource).length);
    }
    expect(board.tiles.flatMap((tile) => tile.number ?? []).toSorted((a,b) => a-b)).toEqual([...NUMBER_SPIRAL].toSorted((a,b) => a-b));
  });

  test("is deterministic and structurally valid for arbitrary seeds", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 0x7fff_ffff }), (seed) => {
      const first = createBoard(seed);
      const second = createBoard(seed);
      expect(first).toEqual(second);
      for (const edge of first.board.edges) {
        expect(edge.vertexIds).toHaveLength(2);
        expect(new Set(edge.vertexIds).size).toBe(2);
      }
      for (const vertex of first.board.vertices) expect(vertex.adjacentVertexIds.length).toBeGreaterThanOrEqual(2);
    }), { numRuns: 200 });
  });
});
