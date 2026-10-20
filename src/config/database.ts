import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'sushigo_user',
  password: process.env.DB_PASSWORD || 'sushigo_pass',
  database: process.env.DB_NAME || 'sushigo_db',
});