import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db/pool.js";

async function baca(rel) {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return readFile(path, "utf8");
}

const auth = await baca("../database/07_auth.sql");
const alur = await baca("../database/12_alur_transaksi.sql");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(auth);
  await client.query(alur);
  await client.query("COMMIT");
  console.log("Migrasi auth dan alur transaksi berhasil.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Migrasi gagal:", error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
