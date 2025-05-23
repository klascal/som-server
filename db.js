const Database = require("better-sqlite3");
const db = new Database("tokens.db");

// Init table
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS users (
    old_refresh_token TEXT PRIMARY KEY,
    new_refresh_token TEXT NOT NULL,
    access_token TEXT NOT NULL
  )
`
).run();

function getUser(oldRefreshToken) {
  return db
    .prepare("SELECT * FROM users WHERE old_refresh_token = ?")
    .get(oldRefreshToken);
}

function saveUser(oldRefreshToken, newRefreshToken, accessToken) {
  db.prepare(
    `
    INSERT OR REPLACE INTO users (old_refresh_token, new_refresh_token, access_token)
    VALUES (?, ?, ?)
  `
  ).run(oldRefreshToken, newRefreshToken, accessToken);
}

function getAllUsers() {
  return db.prepare("SELECT * FROM users").all();
}

module.exports = {
  getUser,
  saveUser,
  getAllUsers,
};
