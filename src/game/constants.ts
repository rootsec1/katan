import type { DevelopmentCard, ResourceBag, Terrain } from "./types";

export const BANK_STARTING_RESOURCES: ResourceBag = {
  brick: 19,
  lumber: 19,
  wool: 19,
  grain: 19,
  ore: 19,
};

export const BUILD_COSTS = {
  road: { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 },
  settlement: { brick: 1, lumber: 1, wool: 1, grain: 1, ore: 0 },
  city: { brick: 0, lumber: 0, wool: 0, grain: 2, ore: 3 },
  development: { brick: 0, lumber: 0, wool: 1, grain: 1, ore: 1 },
} satisfies Record<string, ResourceBag>;

export const TERRAIN_DISTRIBUTION: Terrain[] = [
  "brick",
  "brick",
  "brick",
  "lumber",
  "lumber",
  "lumber",
  "lumber",
  "wool",
  "wool",
  "wool",
  "wool",
  "grain",
  "grain",
  "grain",
  "grain",
  "ore",
  "ore",
  "ore",
  "desert",
];

export const NUMBER_SPIRAL = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

export const DEVELOPMENT_DECK: DevelopmentCard[] = [
  ...Array<DevelopmentCard>(14).fill("knight"),
  "road-building",
  "road-building",
  "invention",
  "invention",
  "monopoly",
  "monopoly",
  ...Array<DevelopmentCard>(5).fill("victory-point"),
];
