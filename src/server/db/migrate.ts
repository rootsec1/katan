import { mkdir } from "node:fs/promises";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:./data/rill.db";
if (url.startsWith("file:")) await mkdir("data", { recursive: true });

const { db } = await import("./client");
await migrate(db, { migrationsFolder: "drizzle" });

console.log("Rill database is ready.");
