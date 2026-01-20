const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",      // your DB username
  host: "localhost",
  database: "nainika",
  password: "yourpassword",
  port: 5432,
});

module.exports = pool;
