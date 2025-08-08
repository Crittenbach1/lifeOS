import {neon} from "@neondatabase/serverless";
import "dotenv/config";
export const sql = neon(process.env.DATABASE_URL);

export async function initDB() {
    console.log("[initDB] starting… NODE_ENV=", process.env.NODE_ENV);
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS bikeRides(
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                lengthInSeconds DECIMAL(10,2) NOT NULL,
                created_at DATE NOT NULL DEFAULT CURRENT_DATE,
                start_time VARCHAR(255) NOT NULL
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS income(
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                created_at DATE NOT NULL DEFAULT CURRENT_DATE,
                minutes_worked DECIMAL(10,2)
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS drinkWater(
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                created_at DATE NOT NULL DEFAULT CURRENT_DATE
            )
        `;


        console.log("Database initialized successfully");
    } catch (error) {
        console.log("Error initializing DB", error);
        process.exit(1);
    }
}