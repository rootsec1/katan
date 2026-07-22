import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/rill.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

export const client = createClient({ url, authToken });
export const db = drizzle(client, { schema });
