import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as platform from "./schema/platform";
import * as risk from "./schema/risk";
import * as processSchema from "./schema/process";
import * as taskSchema from "./schema/task";
import * as moduleSchema from "./schema/module";
import * as assetSchema from "./schema/asset";
import * as workItemSchema from "./schema/work-item";
import * as controlSchema from "./schema/control";
import * as documentSchema from "./schema/document";
import * as catalogSchema from "./schema/catalog";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, {
  schema: { ...platform, ...risk, ...processSchema, ...taskSchema, ...moduleSchema, ...assetSchema, ...workItemSchema, ...controlSchema, ...documentSchema, ...catalogSchema },
});

export type Database = typeof db;
export * from "./schema/platform";
export * from "./schema/risk";
export * from "./schema/process";
export * from "./schema/task";
export * from "./schema/module";
export * from "./schema/asset";
export * from "./schema/work-item";
export * from "./schema/control";
export * from "./schema/document";
export * from "./schema/catalog";
