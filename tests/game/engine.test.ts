import { describe, expect, test } from "bun:test";
import { applyCommand, emptyResourceBag, legalActionsFor, randomInt, redactState, RESOURCES, totalResources, type GameState } from "@/game";
import { botGame, finishSetup, nextBotCommand } from "./helpers";

describe("base rules engine", () => {
  function playing(seed = 55): GameState {
    return finishSetup(botGame(seed));
  }

  function rngForTotal(total: number): number {
    for (let seed = 1; seed < 100_000; seed += 1) {
      const [first, next] = randomInt(seed, 6);
      const [second] = randomInt(next, 6);
      if (first + second + 2 === total) return seed;
    }
    throw new Error("No dice seed found");
  }
  test("runs the forward/reverse setup and grants second-settlement resources", () => {
    const setup = botGame(71, 4);
    expect(redactState(setup, setup.setupOrder[setup.setupIndex]).activePlayerId).toBe(setup.setupOrder[setup.setupIndex]);
    expect(setup.setupOrder).toEqual([...setup.setupOrder.slice(0,4), ...setup.setupOrder.slice(0,4).toReversed()]);
    const playing = finishSetup(setup);
    expect(playing.status).toBe("playing");
    expect(playing.phase).toBe("pre-roll");
    expect(Object.keys(playing.board!.buildings)).toHaveLength(8);
    expect(Object.keys(playing.board!.roads)).toHaveLength(8);
    expect(playing.players.every((player) => totalResources(player.resources) >= 1)).toBeTrue();
  });

  test("enforces the distance rule and connected route placement", () => {
    let state = botGame(12);
    const playerId = state.setupOrder[0];
    const first = legalActionsFor(state, playerId).settlementVertices[0];
    state = applyCommand(state, { type: "place-settlement", playerId, vertexId: first }).state;
    const neighbor = state.board!.vertices.find((vertex) => vertex.id === first)!.adjacentVertexIds[0];
    expect(() => applyCommand(state, { type: "place-settlement", playerId: state.setupOrder[state.setupIndex], vertexId: neighbor })).toThrow();
    const roads = legalActionsFor(state, playerId).roadEdges;
    expect(roads.length).toBeGreaterThan(0);
    expect(roads.every((edgeId) => state.board!.edges.find((edge) => edge.id === edgeId)!.vertexIds.includes(first))).toBeTrue();
  });

  test("does not expose hands, deck order, or RNG to another player", () => {
    const state = finishSetup(botGame(90));
    state.players[0].resources.ore = 4;
    state.players[0].developmentCards.push({ id: "secret", type: "victory-point", boughtTurn: 0 });
    const view = redactState(state, state.players[1].id);
    expect(view.players[0].resourceCount).toBe(totalResources(state.players[0].resources));
    expect(view.players[0].developmentCardCount).toBe(1);
    expect(JSON.stringify(view)).not.toContain("secret");
    expect("developmentDeck" in view).toBeFalse();
    expect("rngState" in view).toBeFalse();
  });

  test("requires exactly half a large hand to be discarded", () => {
    const state = finishSetup(botGame(101));
    const player = state.players[0];
    player.resources = { brick: 4, lumber: 4, wool: 1, grain: 0, ore: 0 };
    state.phase = "discard";
    state.pending.discards[player.id] = 4;
    expect(() => applyCommand(state, { type: "discard", playerId: player.id, resources: { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 } })).toThrow();
    const result = applyCommand(state, { type: "discard", playerId: player.id, resources: { brick: 2, lumber: 2, wool: 0, grain: 0, ore: 0 } }).state;
    expect(totalResources(result.players[0].resources)).toBe(5);
  });

  test("a development card cannot be played on its purchase turn", () => {
    const state = finishSetup(botGame(33));
    const active = state.players[state.activePlayerIndex];
    state.phase = "action";
    active.resources = { brick: 0, lumber: 0, wool: 1, grain: 1, ore: 1 };
    state.developmentDeck = ["knight"];
    const bought = applyCommand(state, { type: "buy-development", playerId: active.id }).state;
    expect(bought.players[bought.activePlayerIndex].developmentCards[0].type).toBe("knight");
    expect(() => applyCommand(bought, { type: "play-knight", playerId: active.id })).toThrow();
  });

  test("bank trades use the best owned harbor ratio", () => {
    const state = finishSetup(botGame(810));
    const active = state.players[state.activePlayerIndex];
    state.phase = "action";
    active.resources = { brick: 4, lumber: 0, wool: 0, grain: 0, ore: 0 };
    const before = state.bank.grain;
    const traded = applyCommand(state, { type: "bank-trade", playerId: active.id, give: "brick", receive: "grain" }).state;
    expect(traded.players[traded.activePlayerIndex].resources.brick).toBe(0);
    expect(traded.players[traded.activePlayerIndex].resources.grain).toBe(1);
    expect(traded.bank.grain).toBe(before - 1);
  });

  test("withholds a scarce production type from multiple claimants but gives a sole claimant what remains", () => {
    const base = playing(240);
    const tile = base.board!.tiles.find((candidate) => candidate.terrain !== "desert" && candidate.number === 6)!;
    const resource = tile.terrain as keyof typeof base.bank;
    base.board!.buildings = {
      [tile.vertexIds[0]]: { playerId: base.players[0].id, kind: "city" },
      [tile.vertexIds[2]]: { playerId: base.players[1].id, kind: "city" },
    };
    base.board!.robberTileId = base.board!.tiles.find((candidate) => candidate.id !== tile.id)!.id;
    base.bank[resource] = 3;
    base.players.forEach((player) => { player.resources[resource] = 0; });
    base.phase = "pre-roll";
    base.rngState = rngForTotal(6);
    const shortage = applyCommand(base, { type: "roll-dice", playerId: base.players[base.activePlayerIndex].id }).state;
    expect(shortage.players[0].resources[resource]).toBe(0);
    expect(shortage.players[1].resources[resource]).toBe(0);

    const sole = structuredClone(base);
    delete sole.board!.buildings[tile.vertexIds[2]];
    sole.phase = "pre-roll";
    sole.rngState = rngForTotal(6);
    const partial = applyCommand(sole, { type: "roll-dice", playerId: sole.players[sole.activePlayerIndex].id }).state;
    expect(partial.players[0].resources[resource]).toBe(2);
  });

  test("moves the waystone, limits victims to adjacent hands, and transfers a seeded random card", () => {
    const state = playing(350);
    const active = state.players[state.activePlayerIndex];
    const victim = state.players.find((player) => player.id !== active.id)!;
    const tile = state.board!.tiles.find((candidate) => candidate.id !== state.board!.robberTileId)!;
    state.board!.buildings[tile.vertexIds[0]] = { playerId: victim.id, kind: "settlement" };
    victim.resources = { brick: 0, lumber: 0, wool: 1, grain: 0, ore: 0 };
    state.phase = "move-robber";
    state.pending.resumePhase = "action";
    const moved = applyCommand(state, { type: "move-robber", playerId: active.id, tileId: tile.id }).state;
    expect(moved.phase).toBe("steal");
    expect(moved.pending.robberVictims).toEqual([victim.id]);
    const stolen = applyCommand(moved, { type: "steal", playerId: active.id, targetPlayerId: victim.id }).state;
    expect(stolen.players.find((player) => player.id === victim.id)!.resources.wool).toBe(0);
    expect(stolen.players.find((player) => player.id === active.id)!.resources.wool).toBeGreaterThan(0);
    expect(stolen.phase).toBe("action");
  });

  test("executes every action development card and enforces one per turn", () => {
    const base = playing(444);
    const active = base.players[base.activePlayerIndex];
    base.phase = "action";
    base.turn = 9;
    active.developmentCards = ["knight", "road-building", "invention", "monopoly"].map((type, index) => ({ id: `card-${index}`, type: type as "knight" | "road-building" | "invention" | "monopoly", boughtTurn: 2 }));
    const knight = applyCommand(base, { type: "play-knight", playerId: active.id }).state;
    expect(knight.phase).toBe("move-robber");
    expect(knight.players[knight.activePlayerIndex].playedKnights).toBe(1);
    expect(() => applyCommand(knight, { type: "play-invention", playerId: active.id, resources: ["ore", "grain"] })).toThrow();

    const road = applyCommand(base, { type: "play-road-building", playerId: active.id }).state;
    expect(road.phase).toBe("road-building");
    expect(road.pending.freeRoads).toBe(2);

    const invention = applyCommand(base, { type: "play-invention", playerId: active.id, resources: ["ore", "grain"] }).state;
    expect(invention.players[invention.activePlayerIndex].resources.ore).toBe(active.resources.ore + 1);
    expect(invention.players[invention.activePlayerIndex].resources.grain).toBe(active.resources.grain + 1);

    const rival = base.players.find((player) => player.id !== active.id)!;
    rival.resources.brick = 3;
    const availableBrick = base.players.filter((player) => player.id !== active.id).reduce((sum, player) => sum + player.resources.brick, 0);
    const monopoly = applyCommand(base, { type: "play-monopoly", playerId: active.id, resource: "brick" }).state;
    expect(monopoly.players.find((player) => player.id === rival.id)!.resources.brick).toBe(0);
    expect(monopoly.players[monopoly.activePlayerIndex].resources.brick).toBe(active.resources.brick + availableBrick);
  });

  test("supports broadcast offers, targeted counteroffers, acceptance, and server revalidation", () => {
    let state = playing(710);
    const active = state.players[state.activePlayerIndex];
    const rival = state.players.find((player) => player.id !== active.id)!;
    state.phase = "action";
    active.resources = { brick: 2, lumber: 1, wool: 0, grain: 0, ore: 0 };
    rival.resources = { brick: 0, lumber: 0, wool: 1, grain: 2, ore: 0 };
    state = applyCommand(state, { type: "offer-trade", playerId: active.id, toPlayerId: null, give: { brick: 2, lumber: 0, wool: 0, grain: 0, ore: 0 }, receive: { brick: 0, lumber: 0, wool: 1, grain: 0, ore: 0 } }).state;
    const passer = state.players.find((player) => player.id !== active.id && player.id !== rival.id)!;
    state = applyCommand(state, { type: "respond-trade", playerId: passer.id, tradeId: state.trades[0].id, accept: false }).state;
    expect(state.trades[0].status).toBe("open");
    expect(state.trades[0].responses[passer.id]).toBe("rejected");
    state = applyCommand(state, { type: "offer-trade", playerId: rival.id, toPlayerId: active.id, give: { brick: 0, lumber: 0, wool: 0, grain: 2, ore: 0 }, receive: { brick: 0, lumber: 1, wool: 0, grain: 0, ore: 0 } }).state;
    const counter = state.trades.at(-1)!;
    state = applyCommand(state, { type: "respond-trade", playerId: active.id, tradeId: counter.id, accept: true }).state;
    expect(state.players.find((player) => player.id === active.id)!.resources.grain).toBe(2);
    expect(state.players.find((player) => player.id === rival.id)!.resources.lumber).toBe(1);
    const original = state.trades[0];
    state.players.find((player) => player.id === active.id)!.resources.brick = 0;
    expect(() => applyCommand(state, { type: "respond-trade", playerId: rival.id, tradeId: original.id, accept: true })).toThrow();
  });

  test("seeded bot games conserve every resource and finish without illegal moves", () => {
    for (const seats of [3, 4] as const) {
      for (let seed = 1; seed <= 30; seed += 1) {
        let state = botGame(seed * 97, seats, seed % 3 === 0 ? "hard" : seed % 2 === 0 ? "easy" : "normal");
        for (let step = 0; step < 6_000 && state.status !== "finished"; step += 1) {
          for (const resource of RESOURCES) {
            expect(state.bank[resource] + state.players.reduce((sum, player) => sum + player.resources[resource], 0)).toBe(19);
          }
          const command = nextBotCommand(state);
          expect(command).not.toBeNull();
          state = applyCommand(state, command!).state;
        }
        expect(state.status).toBe("finished");
        expect(state.winnerPlayerId).not.toBeNull();
      }
    }
  }, 15_000);

  test("empty resource bags remain independent", () => {
    const first = emptyResourceBag(); const second = emptyResourceBag(); first.ore = 2;
    expect(second.ore).toBe(0);
  });
});
