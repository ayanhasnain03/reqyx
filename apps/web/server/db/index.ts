import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as {
  reqyxDb?: ReturnType<typeof createDb>;
};

export const db = globalForDb.reqyxDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.reqyxDb = db;
}
