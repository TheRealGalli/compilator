import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
    console.warn(
        "[DB] DATABASE_URL not set. Database interactions will fail. Using fallback storage if available."
    );
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
