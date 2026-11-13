import { pool } from "../db/pool.js";
import { transaksi } from "../db/transaksi.js";
import { HttpError, metaHalaman } from "../lib/api.js";

const kolom = `p.id, p.penyedia_id, py.nama_usaha AS penyedia,
  p.nama, p.kategori, p.harga_normal, p.harga_penawaran,
  p.stok, p.satuan, p.status, p.berakhir_pada, p.dibuat_pada,
  p.versi, p.foto_hash`;
const gabung = `FROM penawaran p JOIN penyedia py ON py.id=p.penyedia_id
  JOIN pengguna pemilik ON pemilik.id=py.pengguna_id`;

export function kePenawaran(row) {
  return {
    id: String(row.id),
    penyediaId: String(row.penyedia_id),
    penyedia: row.penyedia,
    nama: row.nama,
    kategori: row.kategori,
    hargaNormal: Number(row.harga_normal),
    hargaPenawaran: Number(row.harga_penawaran),
    stok: row.stok,
    satuan: row.satuan,
    status: row.status,
    berakhirPada: new Date(row.berakhir_pada).toISOString(),
    dibuatPada: new Date(row.dibuat_pada).toISOString(),
    versi: String(row.versi ?? 0),
    fotoUrl: row.foto_hash ? `/api/penawaran/${row.id}/foto?v=${row.foto_hash}` : null,
  };
}

export async function bacaPenawaran(id, db = pool, publik = false) {
  const hasil = await db.query(
    `SELECT ${kolom} ${gabung} WHERE p.id=$1
      AND (NOT $2::boolean OR (p.status='aktif' AND p.stok>0
      AND p.berakhir_pada>clock_timestamp() AND pemilik.aktif=TRUE
      AND pemilik.peran='penyedia' AND
      py.status_verifikasi='terverifikasi'))`,
    [id, publik],
  );
  if (!hasil.rowCount) {
    throw new HttpError(404, "OFFER_NOT_FOUND", "Penawaran tidak ditemukan.");
  }
  return kePenawaran(hasil.rows[0]);
}

export async function bacaPenawaranMilik(id, penyediaId) {
  const hasil = await pool.query(
    `SELECT ${kolom} ${gabung} WHERE p.id=$1 AND p.penyedia_id=$2`,
    [id, penyediaId],
  );
  if (!hasil.rowCount) {
    throw new HttpError(404, "OFFER_NOT_FOUND", "Penawaran tidak ditemukan.");
  }
  return kePenawaran(hasil.rows[0]);
}

export async function bacaFoto(id) {
  const hasil = await pool.query(
    `SELECT foto, foto_tipe, foto_hash FROM penawaran WHERE id=$1`,
    [id],
  );
  if (!hasil.rowCount || !hasil.rows[0].foto) {
    throw new HttpError(404, "OFFER_NOT_FOUND", "Foto tidak ditemukan.");
  }
  return hasil.rows[0];
}

export function daftarPenawaran(filter, paging, pemilikId = null) {
  return transaksi(async (client) => {
    const where = `WHERE ($1::text = '' OR
      POSITION(LOWER($1) IN LOWER(p.nama || ' ' || py.nama_usaha)) > 0)
      AND ($2::text = '' OR p.kategori = $2)
      AND ($3::text = '' OR p.status = $3)
      AND (NOT $4::boolean OR (p.status = 'aktif' AND p.stok > 0
      AND p.berakhir_pada>clock_timestamp() AND pemilik.aktif=TRUE
      AND pemilik.peran='penyedia' AND
      py.status_verifikasi='terverifikasi'))
      AND ($5::bigint IS NULL OR p.penyedia_id=$5)`;
    const nilai = [
      filter.q ?? "",
      filter.kategori ?? "",
      filter.status ?? "",
      Boolean(filter.tersedia),
      pemilikId,
    ];
    const count = await client.query(
      `SELECT COUNT(*)::int AS jumlah ${gabung} ${where}`,
      nilai,
    );
    const hasil = await client.query(
      `SELECT ${kolom} ${gabung} ${where}
       ORDER BY p.id DESC LIMIT $6 OFFSET $7`,
      [...nilai, paging.limit, paging.offset],
    );
    return {
      data: hasil.rows.map(kePenawaran),
      meta: metaHalaman(count.rows[0].jumlah, paging),
    };
  }, true);
}

export async function simpanPenawaran(data, id = null, penyediaId) {
  return transaksi(async (client) => {
    const py = await client.query(
      `SELECT py.id FROM penyedia py JOIN pengguna u ON u.id = py.pengguna_id
       WHERE py.id=$1 AND u.peran='penyedia' AND u.aktif=TRUE
       AND py.status_verifikasi='terverifikasi'`,
      [penyediaId],
    );
    if (!py.rowCount) {
      throw new HttpError(404, "PROVIDER_NOT_FOUND", "Penyedia aktif tidak ditemukan.");
    }
    if (id === null) {
      const foto = data.foto?.mode === "set" ? data.foto : null;
      const hasil = await client.query(
        `INSERT INTO penawaran (penyedia_id, nama, kategori, harga_normal,
          harga_penawaran, stok, satuan, status, berakhir_pada, foto, foto_tipe, foto_hash, versi)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0) RETURNING id`,
        [
          penyediaId, data.nama, data.kategori, data.hargaNormal, data.hargaPenawaran,
          data.stok, data.satuan, data.status, data.berakhirPada,
          foto?.buffer ?? null, foto?.tipe ?? null, foto?.hash ?? null,
        ],
      );
      return bacaPenawaran(hasil.rows[0].id, client);
    }

    const lama = await client.query(
      `SELECT id, versi FROM penawaran WHERE id=$1 AND penyedia_id=$2 FOR UPDATE`,
      [id, penyediaId],
    );
    if (!lama.rowCount) {
      throw new HttpError(404, "OFFER_NOT_FOUND", "Penawaran tidak ditemukan.");
    }
    if (String(lama.rows[0].versi) !== String(data.versi)) {
      throw new HttpError(409, "OFFER_CHANGED", "Versi penawaran sudah berubah. Muat versi terbaru.");
    }
    let setFoto = "";
    const nilai = [
      penyediaId, data.nama, data.kategori, data.hargaNormal, data.hargaPenawaran,
      data.stok, data.satuan, data.status, data.berakhirPada, id,
    ];
    if (data.foto?.mode === "set") {
      setFoto = ", foto=$11, foto_tipe=$12, foto_hash=$13";
      nilai.push(data.foto.buffer, data.foto.tipe, data.foto.hash);
    } else if (data.foto?.mode === "hapus") {
      setFoto = ", foto=NULL, foto_tipe=NULL, foto_hash=NULL";
    }
    const hasil = await client.query(
      `UPDATE penawaran SET nama=$2, kategori=$3, harga_normal=$4,
        harga_penawaran=$5, stok=$6, satuan=$7, status=$8, berakhir_pada=$9,
        versi=versi+1 ${setFoto}
       WHERE id=$10 AND penyedia_id=$1 RETURNING id`,
      nilai,
    );
    return bacaPenawaran(hasil.rows[0].id, client);
  });
}

export async function hapusPenawaran(id, penyediaId) {
  const hasil = await pool.query(
    "DELETE FROM penawaran WHERE id=$1 AND penyedia_id=$2 RETURNING id",
    [id, penyediaId],
  );
  if (!hasil.rowCount) {
    throw new HttpError(404, "OFFER_NOT_FOUND", "Penawaran tidak ditemukan.");
  }
}
