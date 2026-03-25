import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as platform from "./schema/platform";
import * as risk from "./schema/risk";
import * as processSchema from "./schema/process";
import * as taskSchema from "./schema/task";
import * as moduleSchema from "./schema/module";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, {
  schema: { ...platform, ...risk, ...processSchema, ...taskSchema, ...moduleSchema },
});

export type Database = typeof db;
export * from "./schema/platform";
export * from "./schema/risk";
export * from "./schema/process";
export * from "./schema/task";
export * from "./schema/module";
