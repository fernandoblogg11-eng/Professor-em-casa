require('dotenv').config();
const { Pool, types } = require('pg');
types.setTypeParser(1082, v => v); // date -> 'YYYY-MM-DD' (sem fuso)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});
module.exports = { query: (text, params) => pool.query(text, params) };
