import { pool } from "../db";

export async function createUser(username: string, passwordHash: string) {
  const result = await pool.query(
    "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
    [username, passwordHash]
  );
  return result.rows[0];
}

export async function findUserByUsername(username: string) {
  const result = await pool.query("SELECT id, username, password_hash FROM users WHERE username = $1", [username]);
  return result.rows[0] ?? null;
}
