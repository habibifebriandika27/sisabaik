import { pool } from "../src/db/pool.js";

async function main() {
  try {
    await pool.query("SELECT 1");
    const t = await pool.query("SELECT to_regclass('public.penawaran') AS p, to_regclass('public.pesanan') AS o");
    console.log("Database terhubung:", t.rows[0]);
    console.log("Workflow test otomatis pendamping tidak disertakan di salinan ini.");
    console.log("Uji manual: ikuti Langkah 13–15 modul (foto, edit/versi, pesanan/aksi, pembayaran, dashboard).");
  } catch (e) {
    console.error("Gagal terhubung/cek database:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
main();
