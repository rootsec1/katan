import { applyCommand, RESOURCES, type BotDifficulty } from "../src/game";
import { botGame, nextBotCommand } from "../tests/game/helpers";

const runs = Number(process.argv[2] ?? 1000);
const started = performance.now();
let turns = 0;
for (let run = 1; run <= runs; run += 1) {
  const seats = run % 2 ? 3 : 4;
  const difficulty: BotDifficulty = run % 3 === 0 ? "hard" : run % 3 === 1 ? "normal" : "easy";
  let state = botGame(run * 7919, seats, difficulty);
  for (let step = 0; step < 8_000 && state.status !== "finished"; step += 1) {
    for (const resource of RESOURCES) {
      const count = state.bank[resource] + state.players.reduce((sum, player) => sum + player.resources[resource], 0);
      if (count !== 19) throw new Error(`${resource} conservation failed in run ${run}: ${count}`);
    }
    const command = nextBotCommand(state);
    if (!command) throw new Error(`Deadlock in run ${run}, phase ${state.phase}`);
    state = applyCommand(state, command).state;
  }
  if (state.status !== "finished") throw new Error(`Run ${run} exceeded the step budget`);
  turns += state.turn;
}
const elapsed = Math.round(performance.now() - started);
console.log(`${runs} seeded games finished in ${elapsed}ms; average ${Math.round(turns / runs)} turns.`);
