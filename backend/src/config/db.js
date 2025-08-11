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

        await sql`
            CREATE TABLE IF NOT EXISTS gymReps(
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                activity_name VARCHAR(255) NOT NULL, -- name of exercise
                created_at DATE NOT NULL DEFAULT CURRENT_DATE
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS codingTasks(
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                task_description TEXT NOT NULL, -- can store long paragraphs
                created_at DATE NOT NULL DEFAULT CURRENT_DATE
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS musicTasks(
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                task_description TEXT NOT NULL, -- can store long paragraphs
                created_at DATE NOT NULL DEFAULT CURRENT_DATE
            )
        `;

        await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`; 

        await sql`
            CREATE TABLE IF NOT EXISTS books (
                id uuid primary key default gen_random_uuid(),
                user_id text not null,
                title text not null,
                author text not null,                         
                total_pages int not null check (total_pages > 0),
                chapters jsonb not null default '[]'::jsonb check (jsonb_typeof(chapters) = 'array'),
                created_at timestamptz not null default now()
            )
        `;
        
        await sql`
            CREATE TABLE IF NOT EXISTS readingTasks (
                id uuid primary key default gen_random_uuid(),
                user_id text not null,
                book_id uuid not null references books(id) on delete cascade,
                stopped_page int not null check (stopped_page >= 0),
                notes text,
                created_at timestamptz not null default now()
            )
        `;

    
        console.log("Database initialized successfully");
    } catch (error) {
        console.log("Error initializing DB", error);
        process.exit(1);
    }
}