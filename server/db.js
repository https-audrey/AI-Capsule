// db.js - opens SQLite and applies schema.sql on start-up.
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const defaultDbPath = process.env.VERCEL
  ? "/tmp/capsules.db"
  : path.join(__dirname, "data", "capsules.db");
const DB_PATH = process.env.DB_PATH || defaultDbPath;
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

module.exports = db;
