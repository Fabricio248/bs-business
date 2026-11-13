// const path = require('path');
// // Garante o caminho absoluto para o arquivo conexao.env na raiz do projeto
// require('dotenv').config({ path: path.join(__dirname, 'Index/.env') });

// const { Pool } = require('pg');

// console.log('--- TESTE DE LEITURA DO .ENV ---');
// console.log('Banco:', process.env.DB_NAME);
// console.log('Usuário:', process.env.DB_USER);
// console.log('Senha carregada?:', process.env.DB_PASSWORD ? 'SIM (texto)' : 'NÃO (undefined!)');
// console.log('--------------------------------');


// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT) || 5432,
//   database: process.env.DB_NAME,
//   user: process.env.DB_USER,
//   password: String(process.env.DB_PASSWORD || '')
// });

// module.exports = pool;

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'B.S.BUSINESS',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345@',
});

module.exports = pool;