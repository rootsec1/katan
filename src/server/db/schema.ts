import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    status: text("status").notNull(),
    hostPlayerId: text("host_player_id").notNull(),
    seatCount: integer("seat_count").notNull(),
    state: text("state").notNull(),
    version: integer("version").notNull().default(0),
    automationLockUntil: integer("automation_lock_until", { mode: "timestamp_ms" }),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("rooms_expires_at_idx").on(table.expiresAt)],
);

export const seats = sqliteTable(
  "seats",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull(),
    position: integer("position").notNull(),
    resumeTokenHash: text("resume_token_hash").notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    disconnectedAt: integer("disconnected_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("seats_room_player_idx").on(table.roomId, table.playerId),
    uniqueIndex("seats_room_position_idx").on(table.roomId, table.position),
  ],
);

export const roomEvents = sqliteTable(
  "room_events",
  {
    sequence: integer("sequence").primaryKey({ autoIncrement: true }),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    commandId: text("command_id").notNull(),
    revision: integer("revision").notNull(),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("events_room_command_idx").on(table.roomId, table.commandId),
    index("events_room_sequence_idx").on(table.roomId, table.sequence),
  ],
);
