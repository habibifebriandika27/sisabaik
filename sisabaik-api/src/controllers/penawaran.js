import * as dataRepo from "../repositories/penawaran.js";
import { idValid, halamanValid, filterValid, salah } from "../lib/api.js";
import { penawaranSesiValid } from "../lib/input-auth.js";

export async function daftar(req, res) {
  const filter = filterValid(req.query);
  if ((filter.status && filter.status !== "aktif") || req.query.tersedia === "false") {
    salah("Katalog publik hanya menampilkan penawaran aktif yang tersedia.");
  }
  const hasil = await dataRepo.daftarPenawaran(
    { ...filter, status: "aktif", tersedia: true },
    halamanValid(req.query),
  );
  return res.json({ success: true, ...hasil });
}

export async function milikSaya(req, res) {
  const hasil = await dataRepo.daftarPenawaran(
    filterValid(req.query),
    halamanValid(req.query),
    req.pengguna.penyediaId,
  );
  return res.json({ success: true, ...hasil });
}

export async function milikSayaDetail(req, res) {
  const hasil = await dataRepo.bacaPenawaranMilik(
    idValid(req.params.id),
    req.pengguna.penyediaId,
  );
  return res.json({ success: true, data: hasil });
}

export async function foto(req, res) {
  const row = await dataRepo.bacaFoto(idValid(req.params.id));
  res.set("Content-Type", row.foto_tipe || "image/webp");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  return res.send(row.foto);
}

export async function detail(req, res) {
  const hasil = await dataRepo.bacaPenawaran(idValid(req.params.id), undefined, true);
  return res.json({ success: true, data: hasil });
}

export async function buat(req, res) {
  const body = await penawaranSesiValid(req.body, req.pengguna, false);
  const hasil = await dataRepo.simpanPenawaran(body, null, req.pengguna.penyediaId);
  return res.status(201).location(`/api/penawaran/${hasil.id}`).json({ success: true, data: hasil });
}

export async function ubah(req, res) {
  const body = await penawaranSesiValid(req.body, req.pengguna, true);
  const hasil = await dataRepo.simpanPenawaran(
    body,
    idValid(req.params.id),
    req.pengguna.penyediaId,
  );
  return res.json({ success: true, data: hasil });
}

export async function hapus(req, res) {
  await dataRepo.hapusPenawaran(idValid(req.params.id), req.pengguna.penyediaId);
  return res.status(204).end();
}
