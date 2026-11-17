const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config();

// Remove parâmetros conflitantes da URL para configurar o SSL explicitamente
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.split('?')[0]
  : null;

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'B.S.BUSINESS',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
      }
);

module.exports = pool;