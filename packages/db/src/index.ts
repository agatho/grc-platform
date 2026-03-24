import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as platform from "./schema/platform";
import * as risk from "./schema/risk";
import * as processSchema from "./schema/process";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, {
  schema: { ...platform, ...risk, ...processSchema },
});

export type Database = typeof db;
export * from "./schema/platform";
export * from "./schema/risk";
export * from "./schema/process";
