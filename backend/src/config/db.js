import {neon} from "@neondatabase/serverless";
import "dotenv/config";
export const sql = neon(process.env.DATABASE_URL);

export async function initDB() {
    console.log("[initDB] starting… NODE_ENV=", process.env.NODE_ENV);
    try {
        

        await sql`
            CREATE TABLE IF NOT EXISTS taskType (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL, -- e.g. "Gym", "Drink Water"
                
                -- Array of objects: [{ "dayOfWeek": 1, "times": ["07:30", "18:00"] }]
                schedules JSONB NOT NULL,

                priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 10),
                trackBy VARCHAR(255) NOT NULL, -- arbitrary string, e.g. "duration", "count"

                -- Array of category names
                categories TEXT[] NOT NULL DEFAULT '{}',

                -- Goals
                yearlyGoal INTEGER DEFAULT 0,
                monthlyGoal INTEGER DEFAULT 0,
                weeklyGoal INTEGER DEFAULT 0,
                dailyGoal INTEGER DEFAULT 0,

                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `;


        await sql`
            CREATE TABLE IF NOT EXISTS taskItem (
                id SERIAL PRIMARY KEY,
                taskTypeID INTEGER NOT NULL REFERENCES taskType(id) ON DELETE CASCADE,
                
                name VARCHAR(255),
                amount DECIMAL(10, 2),
                description TEXT,
                taskCategory VARCHAR(255),

                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `;

        
        console.log("Database initialized successfully");
    } catch (error) {
        console.log("Error initializing DB", error);
        process.exit(1);
    }
}