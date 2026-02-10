import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL must be set. Ensure Cloud SQL is provisioned and the connection string is valid."
    );
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
