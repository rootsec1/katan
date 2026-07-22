import { applyCommand, chooseBotCommand, createLobby, type BotDifficulty, type GameState, type RoomCommand } from "@/game";

export function botGame(seed = 42, seats: 3 | 4 = 3, difficulty: BotDifficulty = "normal"): GameState {
  let state = createLobby({ id: `game-${seed}`, seed, hostPlayerId: "p0", hostName: "P0", seatCount: seats });
  for (let index = 1; index < seats; index += 1) {
    state = applyCommand(state, { type: "add-bot", playerId: "p0", name: `P${index}`, difficulty }).state;
  }
  state = applyCommand(state, { type: "set-ready", playerId: "p0", ready: true }).state;
  state = applyCommand(state, { type: "start-game", playerId: "p0" }).state;
  state.players[0].kind = "bot";
  state.players[0].difficulty = difficulty;
  return state;
}

export function nextBotCommand(state: GameState): RoomCommand | null {
  if (state.phase === "discard") {
    for (const player of state.players) {
      const command = chooseBotCommand(state, player.id);
      if (command) return command;
    }
    return null;
  }
  const playerId = state.status === "setup" ? state.setupOrder[state.setupIndex] : state.players[state.activePlayerIndex]?.id;
  return playerId ? chooseBotCommand(state, playerId) : null;
}

export function finishSetup(state: GameState): GameState {
  let current = state;
  for (let step = 0; step < 20 && current.status === "setup"; step += 1) {
    const command = nextBotCommand(current);
    if (!command) throw new Error("Setup deadlocked");
    current = applyCommand(current, command).state;
  }
  return current;
}
