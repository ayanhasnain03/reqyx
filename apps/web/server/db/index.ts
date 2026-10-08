import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(connectionString, {
    max: 10,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as {
  reqyxDb?: Db;
};

function getDb(): Db {
  if (!globalForDb.reqyxDb) {
    globalForDb.reqyxDb = createDb();
  }
  return globalForDb.reqyxDb;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
