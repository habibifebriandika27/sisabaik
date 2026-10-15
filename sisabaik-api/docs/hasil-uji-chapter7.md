# Hasil Uji Chapter 7 — SisaBaik API

Catatan ini berisi hasil **aktual** pengujian pada lingkungan lokal, bukan salinan
ekspektasi. Database yang dipakai: `sisabaik_dev` (skema Chapter 6, tanpa reset).

## Lingkungan uji

| Komponen | Nilai |
| --- | --- |
| Node.js | v24.21.0 |
| npm | 12.0.2 |
| Express | 5.2.1 |
| pg | 8.23.1 |
| PostgreSQL | 18 lokal, `127.0.0.1:5432` |
| Database | `sisabaik_dev` (skema + seed Chapter 6 dipertahankan) |
| Branch | `feature/rest-postgresql` |
| Commit diuji | `bfb1538` (tiga commit Chapter 7 pertama) |
| Server | `npm start` (bind `127.0.0.1:3000`) |

Akun seed dipakai: pembeli `siti.pembeli@example.test` (id 3, peran `pembeli`, aktif),
penyedia id 1 (`Lapau Uni Rina`) dan id 2 (`Roti Minang`).

Catatan data: seluruh penawaran seed Chapter 6 sudah melewati `berakhir_pada` ketika uji
dijalankan, sehingga `GET /api/penawaran?tersedia=true` mengembalikan `meta.jumlah` 0.
Hal ini sesuai materi; uji tidak me-reset seed dan membuat penawaran baru dengan waktu
relatif sehari ke depan.

## Ringkasan hasil

| Uji | Perintah | Hasil |
| --- | --- | --- |
| Prasyarat dan seed | `npm run db:check -- 0` | OK: `sisabaik_dev`, enam tabel, tiga penawaran terbaca |
| Uji API lintas skenario | `npm run api:test` | 30 skenario PASS, `SELESAI: pesanan 4, penawaran 6 tetap tersimpan.` |
| Protokol manual (JSON/Content-Type/size) | cuplikan Console/curl | 400 `INVALID_JSON`, 415 `JSON_REQUIRED`, 413 `PAYLOAD_TOO_LARGE` |
| Stok terakhir (dua request bersamaan) | `node scripts/uji-konkurensi.js` | PASS: satu 201, satu 409, stok akhir 0; penawaran uji id 8 |
| Persistensi setelah restart | `Ctrl+C` + `npm start`, `GET /api/pesanan/4` | Pesanan tetap ada, total 10000, hargaSatuan 5000 |

## Matriks pengujian (hasil aktual)

| Skenario | Ekspektasi | Hasil aktual | Efek database yang diperiksa |
| --- | --- | --- | --- |
| Health dan koleksi GET | 200, envelope benar | 200 `success:true`, `database:"connected"` | Database dapat diakses |
| ID bukan angka | 400 | 400 `VALIDATION_ERROR` | Tidak ada SQL cast error ke client |
| ID terlalu besar | 404 | 404 `OFFER_NOT_FOUND` (`9223372036854775807`) | Tidak membuat resource baru |
| ID valid tidak ada | 404 | 404 `OFFER_NOT_FOUND` | Tidak membuat resource baru |
| POST valid penawaran | 201 dan `Location` | 201, `Location: /api/penawaran/5` | Satu row baru; ID string |
| Harga invalid / field asing | 400 | 400 `VALIDATION_ERROR` (`hargaPenawaran` 20000 > `hargaNormal` 10000) | Tidak ada INSERT |
| PUT lengkap | 200 | 200; `id`, `penyediaId`, `dibuatPada` tetap sama | Tidak ada row baru |
| PUT tidak lengkap | 400 | 400 `VALIDATION_ERROR` | Data sebelumnya tidak berubah |
| Pencarian dan filter gabungan | 200, hanya row cocok | 200; `meta.jumlah` 1; `data[0].id` cocok | Hanya row yang cocok |
| Page di luar hasil | 200, data kosong, `meta.jumlah` tetap | 200; `data` kosong; `meta.jumlah` 1 | Metadata total benar |
| q menyerupai SQL injection (`' OR 1=1 --`) | 200, diperlakukan sebagai teks | 200; `meta.jumlah` 0 | Tabel dan jumlah tidak dimanipulasi |
| Batch GET sebelum/sesudah POST pesanan gagal | jumlah header tetap | `meta.jumlah` tidak berubah setelah 409/409 | Rollback penuh |
| DELETE tanpa riwayat | 204 tanpa body | 204, body kosong | Row hilang; GET berikutnya 404 |
| DELETE bersejarah | 409 | 409 `REFERENCE_CONFLICT` | Header/detail pesanan tetap (foreign key `RESTRICT`) |
| Pesanan lintas penyedia | 409 `MIXED_PROVIDER` | 409 `MIXED_PROVIDER` | Stok dan jumlah pesanan tidak berubah |
| Stok kurang (999 dari 2) | 409 `INSUFFICIENT_STOCK` | 409 `INSUFFICIENT_STOCK`; stok tetap 2 | Seluruh perubahan dibatalkan |
| Pesanan valid | 201 dan `Location` | 201, `Location: /api/pesanan/4`; total 10000; `nilaiStokTerselamatkan` 20000 | Header/detail, snapshot, stok, total benar |
| Harga penawaran diubah (5000 → 8000) | Detail lama tetap 5000 | `GET /api/pesanan/4` tetap `hargaSatuan` 5000, `total` 10000 | Snapshot tidak ikut berubah |
| Status penawaran saat stok 0 | Berubah `habis` | 200 `stok:0`, `status:"habis"` | Trigger logika service |
| JSON rusak | 400 `INVALID_JSON` | 400 `INVALID_JSON` | Tidak terjadi perubahan data |
| Content-Type salah | 415 `JSON_REQUIRED` | 415 `JSON_REQUIRED` | Tidak terjadi perubahan data |
| Payload > 20 KB | 413 `PAYLOAD_TOO_LARGE` | 413 `PAYLOAD_TOO_LARGE` | Tidak terjadi perubahan data |
| Restart server | Persistensi tanpa reset schema | `GET /api/pesanan/4` tetap 200 setelah restart | Data pesanan tetap ada |
| Dua request pada stok satu | Satu 201, satu 409 | 201 + 409 (request kedua `OFFER_UNAVAILABLE`); stok 0 | Hanya satu pesanan berhasil |

Skenario paginasi tambahan yang lulus pada `npm run api:test`:
`?page=0` → 400, `?limit=51` → 400, dan `?q=roti&q=nasi` (query berulang) → 400.

## Bukti efek database

Setelah satu run `npm run api:test` dan `scripts/uji-konkurensi.js`:

```
 id |              nama               | stok | status
----+---------------------------------+------+--------
  8 | Uji stok terakhir 1792075566148 |    0 | habis
  6 | Uji C7 1792075560533            |    0 | habis

 id |       status        | total_transaksi | nilai_stok_terselamatkan |              nama
----+---------------------+-----------------+--------------------------+---------------------------------
  5 | menunggu-konfirmasi |            5000 |                    10000 | Uji stok terakhir 1792075566148
  4 | menunggu-konfirmasi |           10000 |                    20000 | Uji C7 1792075560533
```

Snapshot harga: setelah `PUT` mengubah penawaran id 6 menjadi `harga_normal` 20000 dan
`harga_penawaran` 8000, detail pesanan id 4 tetap menyimpan `harga_penawaran_satuan`
5000 dan `subtotal` 10000. Pesanan 4 juga masih 200 setelah server dihentikan dengan
`Ctrl+C` (SIGTERM) lalu dijalankan ulang melalui `npm start`.

Rollback: request lintas penyedia dan stok kurang menghasilkan 409, jumlah header pesanan
(`meta.jumlah`) tidak bertambah, dan stok penawaran uji tetap 2 pada pemeriksaan
`GET /api/penawaran/6` sebelum pesanan valid dibuat. Sequence identity boleh tetap
meningkat setelah rollback; nomor ID berurutan bukan bukti transaksi berhasil.

## Catatan inkonsistensi

Tidak ada kegagalan yang ditemukan pada run ini. Seluruh 30 skenario `npm run api:test`,
tiga uji protokol manual, uji konkurensi, dan pemeriksaan persistensi lulus pada percobaan
pertama dengan kode di commit `bfb1538`.

## Refleksi singkat

Kesulitan yang muncul saat menyiapkan uji bukan pada kode, melainkan pada lingkungan:
cluster PostgreSQL lokal dalam keadaan `down`, sehingga `pg_isready` gagal dan
`npm run db:check` berhenti dengan `ECONNREFUSED`. Perbaikannya adalah menghidupkan
cluster (`sudo systemctl start postgresql`), bukan menyentuh skema atau seed. Setelah
cluster hidup, `db:check` berhasil pada `sisabaik_dev`, dan seluruh uji dijalankan tanpa
reset database. Pelajaran: pesan `ECONNREFUSED` menunjuk ke lapisan koneksi, bukan ke
kueri atau kontrak API.
