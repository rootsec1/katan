export function nextRandom(state: number): [number, number] {
  let value = state | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  const next = value >>> 0 || 0x6d2b79f5;
  return [next / 0x1_0000_0000, next];
}

export function randomInt(state: number, maximum: number): [number, number] {
  const [random, next] = nextRandom(state);
  return [Math.floor(random * maximum), next];
}

export function shuffle<T>(values: readonly T[], state: number): [T[], number] {
  const output = [...values];
  let next = state;
  for (let index = output.length - 1; index > 0; index -= 1) {
    const [other, advanced] = randomInt(next, index + 1);
    next = advanced;
    [output[index], output[other]] = [output[other], output[index]];
  }
  return [output, next];
}
