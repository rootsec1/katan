import { lt } from "drizzle-orm";
import { client, db } from "../src/server/db/client";
import { rooms } from "../src/server/db/schema";

const removed = await db.delete(rooms).where(lt(rooms.expiresAt, new Date())).returning({ id: rooms.id });
console.log(`Removed ${removed.length} expired Rill room${removed.length === 1 ? "" : "s"}.`);
client.close();
