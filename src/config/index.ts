import * as dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  DB: {
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5433', 10),
    database: process.env.PGDATABASE || 'sirh_djibouti',
    user: process.env.PGUSER || 'sirh_app',
    password: process.env.PGPASSWORD || 'sirh_djibouti_2026',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  SESSION_SECRET: process.env.SESSION_SECRET || 'secret-securise-pnd-2026-djibouti'
};
