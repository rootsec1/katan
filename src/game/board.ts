import { NUMBER_SPIRAL, TERRAIN_DISTRIBUTION } from "./constants";
import { shuffle } from "./rng";
import { RESOURCES, type Board, type Edge, type HexTile, type Port, type Vertex } from "./types";

const SQRT_3 = Math.sqrt(3);
const HEX_SIZE = 100;
const CORNER_ANGLES = [30, 90, 150, 210, 270, 330];

function coordinateKey(x: number, y: number): string {
  return `${Math.round(x * 1000)}:${Math.round(y * 1000)}`;
}

function edgeKey(first: string, second: string): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function ring(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
}

export function createBoard(seed: number): { board: Board; rngState: number } {
  let rngState = seed || 0x6d2b79f5;
  const [terrains, terrainState] = shuffle(TERRAIN_DISTRIBUTION, rngState);
  rngState = terrainState;

  const coordinates: Array<{ q: number; r: number; x: number; y: number }> = [];
  for (let q = -2; q <= 2; q += 1) {
    for (let r = -2; r <= 2; r += 1) {
      if (ring(q, r) <= 2) {
        coordinates.push({
          q,
          r,
          x: HEX_SIZE * SQRT_3 * (q + r / 2),
          y: HEX_SIZE * 1.5 * r,
        });
      }
    }
  }

  coordinates.sort((a, b) => {
    const ringDifference = ring(b.q, b.r) - ring(a.q, a.r);
    if (ringDifference !== 0) return ringDifference;
    return Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x);
  });

  const [rotation, rotationState] = (() => {
    const value = rngState % 12;
    return [value, (rngState * 1664525 + 1013904223) >>> 0] as const;
  })();
  rngState = rotationState;
  const orderedCoordinates = [...coordinates.slice(rotation), ...coordinates.slice(0, rotation)];

  const verticesByCoordinate = new Map<string, Vertex>();
  const edgesByVertices = new Map<string, Edge>();
  const tiles: HexTile[] = [];
  let numberIndex = 0;

  orderedCoordinates.forEach((coordinate, tileIndex) => {
    const terrain = terrains[tileIndex];
    const tileId = `h${tileIndex}`;
    const vertexIds: string[] = [];
    const edgeIds: string[] = [];

    for (const angle of CORNER_ANGLES) {
      const radians = (angle * Math.PI) / 180;
      const x = coordinate.x + HEX_SIZE * Math.cos(radians);
      const y = coordinate.y + HEX_SIZE * Math.sin(radians);
      const key = coordinateKey(x, y);
      let vertex = verticesByCoordinate.get(key);
      if (!vertex) {
        vertex = {
          id: `v${verticesByCoordinate.size}`,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          adjacentVertexIds: [],
          edgeIds: [],
          tileIds: [],
          port: null,
        };
        verticesByCoordinate.set(key, vertex);
      }
      vertex.tileIds.push(tileId);
      vertexIds.push(vertex.id);
    }

    for (let index = 0; index < 6; index += 1) {
      const first = vertexIds[index];
      const second = vertexIds[(index + 1) % 6];
      const key = edgeKey(first, second);
      let edge = edgesByVertices.get(key);
      if (!edge) {
        edge = { id: `e${edgesByVertices.size}`, vertexIds: [first, second], tileIds: [] };
        edgesByVertices.set(key, edge);
      }
      edge.tileIds.push(tileId);
      edgeIds.push(edge.id);
    }

    tiles.push({
      id: tileId,
      ...coordinate,
      terrain,
      number: terrain === "desert" ? null : NUMBER_SPIRAL[numberIndex++],
      vertexIds,
      edgeIds,
    });
  });

  const vertices = [...verticesByCoordinate.values()];
  const edges = [...edgesByVertices.values()];
  const vertexById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  for (const edge of edges) {
    const [first, second] = edge.vertexIds;
    vertexById.get(first)?.adjacentVertexIds.push(second);
    vertexById.get(second)?.adjacentVertexIds.push(first);
    vertexById.get(first)?.edgeIds.push(edge.id);
    vertexById.get(second)?.edgeIds.push(edge.id);
  }

  const coastalEdges = edges
    .filter((edge) => edge.tileIds.length === 1)
    .toSorted((first, second) => {
      const firstVertices = first.vertexIds.map((id) => vertexById.get(id)!);
      const secondVertices = second.vertexIds.map((id) => vertexById.get(id)!);
      const firstAngle = Math.atan2(
        (firstVertices[0].y + firstVertices[1].y) / 2,
        (firstVertices[0].x + firstVertices[1].x) / 2,
      );
      const secondAngle = Math.atan2(
        (secondVertices[0].y + secondVertices[1].y) / 2,
        (secondVertices[0].x + secondVertices[1].x) / 2,
      );
      return firstAngle - secondAngle;
    });

  const portKinds: Array<Port["resource"]> = [null, null, null, null, ...RESOURCES];
  const [shuffledPorts, portState] = shuffle(portKinds, rngState);
  rngState = portState;
  const portOffset = rngState % coastalEdges.length;
  const portPositions = [0, 3, 7, 10, 13, 17, 20, 23, 27];
  const ports: Port[] = portPositions
    .map((position) => coastalEdges[(position + portOffset) % coastalEdges.length])
    .map((edge, index) => ({
      id: `p${index}`,
      ratio: shuffledPorts[index] ? 2 : 3,
      resource: shuffledPorts[index],
      edgeId: edge.id,
    }));

  for (const port of ports) {
    const edge = edgesByVertices.get(edgeKey(...(edges.find((item) => item.id === port.edgeId)!.vertexIds)))!;
    for (const vertexId of edge.vertexIds) vertexById.get(vertexId)!.port = port;
  }

  return {
    board: {
      tiles,
      vertices,
      edges,
      ports,
      robberTileId: tiles.find((tile) => tile.terrain === "desert")!.id,
      buildings: {},
      roads: {},
    },
    rngState,
  };
}
