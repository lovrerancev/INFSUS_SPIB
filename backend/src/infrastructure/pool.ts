import pg from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn(
    "[spib-backend] DATABASE_URL nije postavljen. Kopiraj backend/.env.example u backend/.env",
  );
}

export const pool = new pg.Pool({
  connectionString:
    connectionString ??
    "postgresql://spib:spib_dev_promijeni_me@localhost:5432/spib",
  max: 10,
});
