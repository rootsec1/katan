import { describe, expect, test } from "bun:test";
import { longestRouteLength, type Board, type Edge, type Vertex } from "@/game";

function graph(pairs: Array<[string,string]>, blockers: Record<string,string> = {}): Board {
  const names = [...new Set(pairs.flat())];
  const edges: Edge[] = pairs.map(([a,b],index)=>({id:`e${index}`,vertexIds:[a,b],tileIds:[]}));
  const vertices: Vertex[] = names.map((id)=>({id,x:0,y:0,adjacentVertexIds:edges.filter((edge)=>edge.vertexIds.includes(id)).map((edge)=>edge.vertexIds[0]===id?edge.vertexIds[1]:edge.vertexIds[0]),edgeIds:edges.filter((edge)=>edge.vertexIds.includes(id)).map((edge)=>edge.id),tileIds:[],port:null}));
  return { tiles:[],vertices,edges,ports:[],robberTileId:"",buildings:Object.fromEntries(Object.entries(blockers).map(([vertexId,playerId])=>[vertexId,{playerId,kind:"settlement" as const}])),roads:Object.fromEntries(edges.map((edge)=>[edge.id,"p1"])) };
}

describe("longest route graph", () => {
  test("counts a line and stops at an opposing building", () => {
    const board=graph([["a","b"],["b","c"],["c","d"],["d","e"],["e","f"]]);
    expect(longestRouteLength(board,"p1")).toBe(5);
    board.buildings.c={playerId:"p2",kind:"settlement"};
    expect(longestRouteLength(board,"p1")).toBe(3);
  });
  test("uses each edge once through loops", () => {
    expect(longestRouteLength(graph([["a","b"],["b","c"],["c","d"],["d","a"]]),"p1")).toBe(4);
  });
  test("does not add both arms of a fork to its trunk", () => {
    const board=graph([["a","b"],["b","c"],["c","d"],["c","e"],["c","f"]]);
    expect(longestRouteLength(board,"p1")).toBe(3);
  });
  test("can traverse a loop and continue along a tail", () => {
    const board=graph([["a","b"],["b","c"],["c","d"],["d","a"],["a","e"],["e","f"]]);
    expect(longestRouteLength(board,"p1")).toBe(6);
  });
});
