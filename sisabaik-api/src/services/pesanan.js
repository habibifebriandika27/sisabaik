import { transaksi } from "../db/transaksi.js";
import { HttpError, metaHalaman } from "../lib/api.js";

function cakupan(pengguna) {
  if (pengguna.peran === "pembeli") {
    return { kolom: "ps.pembeli_id", id: pengguna.id };
  }
  if (pengguna.peran === "penyedia" && pengguna.penyediaId) {
    return { kolom: "ps.penyedia_id", id: pengguna.penyediaId };
  }
  throw new HttpError(403, "ROLE_FORBIDDEN", "Profil atau peran tidak diizinkan.");
}

const headerSql = `SELECT ps.*, u.nama_lengkap AS nama_pemesan,
  py.nama_usaha AS penyedia
  FROM pesanan ps
  JOIN pengguna u ON u.id=ps.pembeli_id
  JOIN penyedia py ON py.id=ps.penyedia_id`;

function labelPembayaran(row) {
  if (row.status_pembayaran === "gratis") return "Gratis, tanpa pembayaran";
  if (row.status_pembayaran === "dibayar") return "Pembayaran di tempat diterima";
  return "Bayar di tempat saat pengambilan";
}

function bolehAksi(row, pengguna) {
  const peran = pengguna.peran;
  const s = row.status;
  const aksi = [];
  if (s === "selesai" || s === "dibatalkan") return aksi;
  if (peran === "penyedia") {
    if (s === "menunggu-konfirmasi") aksi.push("konfirmasi", "tolak", "batal");
    if (s === "dikonfirmasi") aksi.push("siap", "batal");
    if (s === "siap-diambil") aksi.push("selesai", "batal");
  } else if (peran === "pembeli") {
    if (s === "menunggu-konfirmasi") aksi.push("batal");
  }
  return aksi;
}

async function bacaDetail(id, client, pengguna) {
  const scope = cakupan(pengguna);
  const header = await client.query(
    `${headerSql} WHERE ps.id=$1 AND ${scope.kolom}=$2`,
    [id, scope.id],
  );
  if (!header.rowCount) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "Pesanan tidak ditemukan.");
  }
  const row = header.rows[0];
  const detail = await client.query(
    `SELECT dp.*, p.nama AS nama_saat_ini, p.satuan AS satuan_saat_ini
     FROM detail_pesanan dp
     LEFT JOIN penawaran p ON p.id=dp.penawaran_id
     WHERE dp.pesanan_id=$1 ORDER BY dp.penawaran_id`,
    [id],
  );
  const ambil = await client.query(
    `SELECT kode, status, diambil_pada FROM pengambilan WHERE pesanan_id=$1`,
    [id],
  );
  const g = ambil.rows[0];
  return {
    id: String(row.id),
    pembeliId: String(row.pembeli_id),
    penyediaId: String(row.penyedia_id),
    penyedia: row.penyedia,
    namaPemesan: row.nama_pemesan,
    status: row.status,
    total: Number(row.total_transaksi),
    nilaiStokTerselamatkan: Number(row.nilai_stok_terselamatkan),
    dibuatPada: new Date(row.dibuat_pada).toISOString(),
    metodePembayaran: row.metode_pembayaran || "di-tempat",
    statusPembayaran: row.status_pembayaran || "belum-dibayar",
    dibayarPada: row.dibayar_pada ? new Date(row.dibayar_pada).toISOString() : null,
    dikonfirmasiPada: row.dikonfirmasi_pada ? new Date(row.dikonfirmasi_pada).toISOString() : null,
    siapPada: row.siap_pada ? new Date(row.siap_pada).toISOString() : null,
    selesaiPada: row.selesai_pada ? new Date(row.selesai_pada).toISOString() : null,
    dibatalkanPada: row.dibatalkan_pada ? new Date(row.dibatalkan_pada).toISOString() : null,
    jenisPembatalan: row.jenis_pembatalan || null,
    alasanPembatalan: row.alasan_pembatalan || null,
    pembayaran: { metode: row.metode_pembayaran || "di-tempat", status: row.status_pembayaran || "belum-dibayar", label: labelPembayaran(row) },
    pengambilan: g ? { kode: g.kode, status: g.status, diambilPada: g.diambil_pada ? new Date(g.diambil_pada).toISOString() : null } : null,
    bolehAksi: bolehAksi(row, pengguna),
    items: detail.rows.map((d) => ({
      penawaranId: String(d.penawaran_id),
      nama: d.nama_penawaran || d.nama_saat_ini || "Penawaran",
      satuan: d.satuan || d.satuan_saat_ini || "unit",
      kuantitas: d.kuantitas,
      hargaSatuan: Number(d.harga_penawaran_satuan),
      hargaNormalSatuan: Number(d.harga_normal_satuan),
      subtotal: Number(d.subtotal),
      nilaiStokTerselamatkan: Number(d.nilai_stok),
    })),
  };
}

export function detailPesanan(id, pengguna) {
  return transaksi((client) => bacaDetail(id, client, pengguna), true);
}

export function daftarPesanan(paging, pengguna) {
  const scope = cakupan(pengguna);
  return transaksi(async (client) => {
    const count = await client.query(
      `SELECT COUNT(*)::int AS jumlah FROM pesanan ps WHERE ${scope.kolom}=$1`,
      [scope.id],
    );
    const hasil = await client.query(
      `${headerSql} WHERE ${scope.kolom}=$1
       ORDER BY ps.id DESC LIMIT $2 OFFSET $3`,
      [scope.id, paging.limit, paging.offset],
    );
    const data = [];
    for (const row of hasil.rows) {
      data.push({
        id: String(row.id),
        pembeliId: String(row.pembeli_id),
        penyediaId: String(row.penyedia_id),
        penyedia: row.penyedia,
        namaPemesan: row.nama_pemesan,
        status: row.status,
        total: Number(row.total_transaksi),
        dibuatPada: new Date(row.dibuat_pada).toISOString(),
        statusPembayaran: row.status_pembayaran || "belum-dibayar",
        jenisPembatalan: row.jenis_pembatalan || null,
      });
    }
    return { data, meta: metaHalaman(count.rows[0].jumlah, paging) };
  }, true);
}

export function buatPesanan(data, pengguna) {
  return transaksi(async (client) => {
    const pembeli = await client.query(
      `SELECT id FROM pengguna WHERE id=$1 AND peran='pembeli' AND aktif=TRUE`,
      [pengguna.id],
    );
    if (!pembeli.rowCount) {
      throw new HttpError(404, "BUYER_NOT_FOUND", "Pembeli aktif tidak ditemukan.");
    }

    const detail = [];
    let penyediaId;
    let totalNormal = 0n;
    for (const baris of data.items) {
      const hasil = await client.query(
        `SELECT p.* FROM penawaran p JOIN penyedia py ON py.id=p.penyedia_id
         JOIN pengguna u ON u.id=py.pengguna_id WHERE p.id=$1
         AND u.peran='penyedia' AND u.aktif=TRUE
         AND py.status_verifikasi='terverifikasi' FOR UPDATE OF p`,
        [baris.penawaranId],
      );
      if (!hasil.rowCount) {
        throw new HttpError(404, "OFFER_NOT_FOUND", "Penawaran tidak ditemukan.");
      }
      const item = hasil.rows[0];
      if (item.status !== "aktif" || item.stok < baris.kuantitas || new Date(item.berakhir_pada) <= new Date()) {
        throw new HttpError(409, "OFFER_UNAVAILABLE", "Penawaran tidak tersedia.");
      }
      penyediaId ??= String(item.penyedia_id);
      if (penyediaId !== String(item.penyedia_id)) {
        throw new HttpError(409, "MIXED_PROVIDER", "Satu pesanan harus dari satu penyedia.");
      }
      totalNormal += BigInt(item.harga_normal) * BigInt(baris.kuantitas);
      if (totalNormal > 999999999999n) {
        throw new HttpError(409, "ORDER_TOTAL_LIMIT", "Total melampaui kapasitas skema.");
      }
      detail.push({ ...baris, item });
    }

    const pesanan = await client.query(
      `INSERT INTO pesanan (pembeli_id, penyedia_id, status, metode_pembayaran, status_pembayaran)
       VALUES ($1,$2,'menunggu-konfirmasi','di-tempat','belum-dibayar') RETURNING id`,
      [pembeli.rows[0].id, penyediaId],
    );
    const id = pesanan.rows[0].id;
    for (const { item, kuantitas } of detail) {
      await client.query(
        `INSERT INTO detail_pesanan (pesanan_id, penawaran_id, penyedia_id,
          kuantitas, harga_normal_satuan, harga_penawaran_satuan, nama_penawaran, satuan)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, item.id, penyediaId, kuantitas, item.harga_normal, item.harga_penawaran, item.nama, item.satuan],
      );
      await client.query(
        `UPDATE penawaran SET stok=stok-$1,
          status=CASE WHEN stok-$1<=0 THEN 'habis' ELSE status END,
          versi=versi+1
         WHERE id=$2`,
        [kuantitas, item.id],
      );
    }
    await client.query(
      `UPDATE pesanan ps SET total_transaksi=r.total,
        nilai_stok_terselamatkan=r.nilai_stok,
        status_pembayaran=CASE WHEN r.total=0 THEN 'gratis' ELSE ps.status_pembayaran END
       FROM (SELECT COALESCE(SUM(subtotal),0) AS total, COALESCE(SUM(nilai_stok),0) AS nilai_stok
             FROM detail_pesanan WHERE pesanan_id=$1) r
       WHERE ps.id=$1`,
      [id],
    );
    // buat record pengambilan awal jika tabel mengharuskannya? aman mencoba insert sederhana bila ada
    try {
      const kode = `AMB-${id}-${Date.now().toString(36).toUpperCase()}`;
      await client.query(
        `INSERT INTO pengambilan (pesanan_id, kode, status) VALUES ($1,$2,'menunggu')`,
        [id, kode],
      );
    } catch (_) {
      // abaikan jika skema berbeda; detail akan tetap terbaca bila row ada
    }
    return bacaDetail(id, client, pengguna);
  });
}

async function kembalikanStok(client, pesananId) {
  const rows = await client.query(
    `SELECT penawaran_id, kuantitas FROM detail_pesanan WHERE pesanan_id=$1 FOR UPDATE`,
    [pesananId],
  );
  for (const r of rows.rows) {
    await client.query(
      `UPDATE penawaran SET stok=stok+$1,
        status=CASE WHEN status='habis' AND stok+$1>0 AND berakhir_pada>clock_timestamp() THEN 'aktif' ELSE status END,
        versi=versi+1
       WHERE id=$2`,
      [r.kuantitas, r.penawaran_id],
    );
  }
}

export function aksiPesanan(id, pengguna, data) {
  return transaksi(async (client) => {
    const scope = cakupan(pengguna);
    const lock = await client.query(
      `SELECT * FROM pesanan WHERE id=$1 AND ${scope.kolom}=$2 FOR UPDATE`,
      [id, scope.id],
    );
    if (!lock.rowCount) {
      throw new HttpError(404, "ORDER_NOT_FOUND", "Pesanan tidak ditemukan.");
    }
    const row = lock.rows[0];
    const sekarang = new Date().toISOString();
    const aksi = data.aksi;

    if (row.status === "selesai" || row.status === "dibatalkan") {
      throw new HttpError(409, "ORDER_STATE_CONFLICT", "Pesanan sudah ditutup.");
    }

    if (aksi === "konfirmasi") {
      if (pengguna.peran !== "penyedia" || row.status !== "menunggu-konfirmasi") {
        throw new HttpError(409, "ORDER_STATE_CONFLICT", "Pesanan tidak dapat dikonfirmasi.");
      }
      await client.query(`UPDATE pesanan SET status='dikonfirmasi', dikonfirmasi_pada=$2 WHERE id=$1`, [id, sekarang]);
    } else if (aksi === "siap") {
      if (pengguna.peran !== "penyedia" || row.status !== "dikonfirmasi") {
        throw new HttpError(409, "ORDER_STATE_CONFLICT", "Pesanan belum dapat ditandai siap.");
      }
      await client.query(`UPDATE pesanan SET status='siap-diambil', siap_pada=$2 WHERE id=$1`, [id, sekarang]);
    } else if (aksi === "selesai") {
      if (pengguna.peran !== "penyedia" || row.status !== "siap-diambil") {
        throw new HttpError(409, "ORDER_STATE_CONFLICT", "Pesanan belum dapat diselesaikan.");
      }
      const berbayar = Number(row.total_transaksi) > 0 && row.status_pembayaran !== "gratis";
      if (berbayar && !data.pembayaranDiterima) {
        throw new HttpError(400, "VALIDATION_ERROR", "Konfirmasi penerimaan pembayaran diperlukan.");
      }
      const statusBayar = berbayar ? "dibayar" : (row.status_pembayaran === "gratis" ? "gratis" : "dibayar");
      await client.query(
        `UPDATE pesanan SET status='selesai', selesai_pada=$2, status_pembayaran=$3,
          dibayar_pada=CASE WHEN $3='dibayar' THEN $2 ELSE dibayar_pada END
         WHERE id=$1`,
        [id, sekarang, statusBayar],
      );
      await client.query(
        `UPDATE pengambilan SET status='diambil', diambil_pada=$2 WHERE pesanan_id=$1`,
        [id, sekarang],
      );
    } else if (aksi === "batal" || aksi === "tolak") {
      if (aksi === "tolak") {
        if (pengguna.peran !== "penyedia" || row.status !== "menunggu-konfirmasi") {
          throw new HttpError(409, "ORDER_STATE_CONFLICT", "Pesanan tidak dapat ditolak.");
        }
      } else {
        const bolehPembeli = pengguna.peran === "pembeli" && row.status === "menunggu-konfirmasi";
        const bolehPenyedia = pengguna.peran === "penyedia" && ["menunggu-konfirmasi", "dikonfirmasi", "siap-diambil"].includes(row.status);
        if (!bolehPembeli && !bolehPenyedia) {
          throw new HttpError(409, "ORDER_STATE_CONFLICT", "Pesanan tidak dapat dibatalkan.");
        }
      }
      const jenis = aksi === "tolak" ? "ditolak-penyedia" : (pengguna.peran === "penyedia" ? "penyedia" : "pembeli");
      await kembalikanStok(client, id);
      await client.query(
        `UPDATE pesanan SET status='dibatalkan', dibatalkan_pada=$2, jenis_pembatalan=$3, alasan_pembatalan=$4
         WHERE id=$1`,
        [id, sekarang, jenis, data.alasan],
      );
    } else {
      throw new HttpError(400, "VALIDATION_ERROR", "Aksi tidak dikenal.");
    }

    return bacaDetail(id, client, pengguna);
  });
}
