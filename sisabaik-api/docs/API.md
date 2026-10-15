# Kontrak API SisaBaik — Chapter 7

Server latihan: `http://127.0.0.1:3000` (bind `127.0.0.1`, hanya perangkat sendiri).
Sumber data: PostgreSQL `sisabaik_dev` (skema Chapter 6). Frontend penguji dan API
berada pada origin yang sama sehingga CORS tidak dipakai.

Model response:

```json
{ "success": true, "data": {}, "meta": {} }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Envelope `success`/`data`/`meta`/`error` dipertahankan dari Chapter 5; `meta` ditambah
metadata paginasi (`jumlah`, `page`, `limit`, `totalPages`). `meta.jumlah` adalah total row
yang cocok dengan filter, bukan jumlah row pada halaman saat ini.

## Daftar endpoint

| Method | Path | Fungsi | Response berhasil |
| --- | --- | --- | --- |
| GET | `/api/health` | Memeriksa proses dan akses database | 200, `success: true` |
| GET | `/api/penawaran` | Koleksi penawaran dengan pencarian/filter/paginasi | 200, `data` array dan `meta` |
| GET | `/api/penawaran/:id` | Detail satu penawaran | 200, `data` object |
| POST | `/api/penawaran` | Membuat penawaran | 201, `data` dan header `Location` |
| PUT | `/api/penawaran/:id` | Mengganti seluruh atribut yang dapat diedit | 200, `data` |
| DELETE | `/api/penawaran/:id` | Menghapus penawaran tanpa riwayat pesanan | 204, body kosong |
| GET | `/api/pesanan` | Koleksi ringkasan pesanan terpaginasi | 200, `data` array dan `meta` |
| GET | `/api/pesanan/:id` | Detail pesanan dengan `items` | 200, `data` object |
| POST | `/api/pesanan` | Membuat pesanan atomik | 201, `data` dengan `items` dan `Location` |

Tidak ada endpoint `PATCH`, `PUT /api/pesanan/:id`, `DELETE /api/pesanan/:id`, maupun
endpoint `pengambilan` pada chapter ini.

## Query parameter `GET /api/penawaran`

| Query | Aturan |
| --- | --- |
| `q` | Substring 0–100 karakter pada nama penawaran atau nama usaha, tidak peka huruf besar/kecil (`POSITION(LOWER($1) IN LOWER(...))`). `%` dan `_` bukan wildcard. |
| `kategori` | Kecocokan tepat, 0–40 karakter. |
| `status` | Salah satu dari `draft`, `aktif`, `habis`, `kedaluwarsa`. Kosong = semua. |
| `tersedia` | `true` atau `false` (default `false`). `true` hanya memilih status `aktif`, `stok > 0`, dan `berakhir_pada` belum lewat. |
| `page` | Integer 1–10000, default 1. |
| `limit` | Integer 1–50, default 10. |
| `offset` | Dihitung `(page - 1) * limit`. |

Query berulang seperti `?q=roti&q=nasi` atau `?page=1&page=2` ditolak dengan 400, bukan
dipilih diam-diam. Pengurutan dikunci `ORDER BY p.id DESC`; endpoint tidak menerima nama
kolom `sort` bebas. `COUNT` dan `SELECT` halaman memakai filter dan snapshot
(`REPEATABLE READ READ ONLY`) yang sama.

Contoh:

```
GET /api/penawaran?q=roti&kategori=roti&tersedia=true&page=1&limit=2
```

```json
{
  "success": true,
  "data": [],
  "meta": { "jumlah": 0, "page": 1, "limit": 2, "totalPages": 0, "q": "roti", "kategori": "roti", "status": "", "tersedia": true }
}
```

Page valid yang melewati halaman terakhir menghasilkan `data` kosong dengan `meta.jumlah`
tetap total.

## Body wajib POST/PUT penawaran

Semua field berikut wajib dikirim. ID, `dibuatPada`, dan `penyedia` tidak dikirim client;
`penyediaId` tidak boleh diganti setelah penawaran dibuat.

| Field | Tipe JSON | Aturan |
| --- | --- | --- |
| `penyediaId` | string digit atau number | ID penyedia aktif (peran `penyedia`) |
| `nama` | string | 3–120 karakter |
| `kategori` | string | 1–40 karakter |
| `hargaNormal` | integer rupiah | 1–999999999999 |
| `hargaPenawaran` | integer rupiah | 0–999999999999, tidak melebihi `hargaNormal` |
| `stok` | integer | 0–2147483647 |
| `satuan` | string | 1–20 karakter |
| `status` | string | `draft`, `aktif`, `habis`, atau `kedaluwarsa` |
| `berakhirPada` | string ISO 8601 | Wajib menyertakan zona waktu (`Z` atau `±HH:MM`), tanggal/jam kalender valid, dan berada di masa depan |

Body dengan `id`, `dibuatPada`, atau field tak dikenal ditolak 400. PUT bukan upsert: ID
yang tidak ada menghasilkan 404, bukan penawaran baru. Mengirim `penyediaId` berbeda dari
pemilik lama menghasilkan 409 `PROVIDER_IMMUTABLE`.

## Body wajib POST pesanan

| Field | Tipe JSON | Aturan |
| --- | --- | --- |
| `emailPembeli` | string | Email akun `pengguna` berperan `pembeli` dan aktif. Ini bukan bukti autentikasi. |
| `items` | array 1–10 | Tiap item `{ penawaranId, kuantitas }`; `kuantitas` integer 1–1000; ID tidak boleh ganda |

Aturan satu penyedia: seluruh item dalam satu pesanan harus berasal dari penyedia yang
sama, jika tidak 409 `MIXED_PROVIDER`. Service mengunci penawaran menurut urutan ID
(`SELECT ... FOR UPDATE`) dan memeriksa status, waktu, serta stok setelah lock diperoleh.

## DTO

Nama kolom database tetap `snake_case`; response memakai `camelCase` yang dipakai
frontend Chapter 5. ID `BIGINT` dikirim sebagai string digit; nilai `NUMERIC(12,0)` yang
aman dikonversi menjadi number rupiah.

| Kolom database | Field API | Tipe JSON |
| --- | --- | --- |
| `id`, `penyedia_id` | `id`, `penyediaId` | string digit |
| `harga_normal`, `harga_penawaran` | `hargaNormal`, `hargaPenawaran` | integer rupiah |
| `berakhir_pada`, `dibuat_pada` | `berakhirPada`, `dibuatPada` | string ISO 8601 dengan zona waktu |
| `nama_usaha` (JOIN) | `penyedia` | string |
| `total_transaksi` | `total` | integer rupiah |
| `nilai_stok_terselamatkan` | `nilaiStokTerselamatkan` | integer rupiah (nama field legacy) |
| detail: `harga_penawaran_satuan`, `subtotal`, `nilai_stok` | `hargaSatuan`, `subtotal`, `nilaiStokTerselamatkan` | integer rupiah |

`subtotal` dan `nilai_stok` adalah generated columns; API tidak mengisinya manual. Harga
pesanan disimpan sebagai snapshot sehingga perubahan harga penawaran tidak mengubah
pesanan lama. Nama item dibaca dari tabel `penawaran`, jadi yang disimpan sebagai bukti
historis hanya harga, bukan nama.

## Status dan kode kesalahan

| Status | Kode contoh | Makna |
| --- | --- | --- |
| 200 | — | Pembacaan/perubahan berhasil (GET, PUT) |
| 201 | — | Resource baru dibuat (POST, disertai `Location`) |
| 204 | — | Penghapusan berhasil tanpa body |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `DATA_CONSTRAINT` | Bentuk atau nilai input salah |
| 404 | `OFFER_NOT_FOUND`, `ORDER_NOT_FOUND`, `BUYER_NOT_FOUND`, `PROVIDER_NOT_FOUND`, `ROUTE_NOT_FOUND` | Resource valid tidak ada |
| 409 | `INSUFFICIENT_STOCK`, `OFFER_UNAVAILABLE`, `MIXED_PROVIDER`, `PROVIDER_IMMUTABLE`, `ORDER_TOTAL_LIMIT`, `REFERENCE_CONFLICT`, `DATA_CONFLICT`, `TRANSACTION_BUSY` | Konflik state atau relasi |
| 413 | `PAYLOAD_TOO_LARGE` | Payload melebihi 20 KB |
| 415 | `JSON_REQUIRED` | POST/PUT bukan `application/json` |
| 500 | `INTERNAL_SERVER_ERROR` | Kegagalan server tak terduga |
| 503 | `DATABASE_UNAVAILABLE` | Database belum dapat diakses |

SQLSTATE PostgreSQL dipetakan stabil: `23503`/`23001` → 409, `23514`/`23502`/`22003`/
`22007`/`22008`/`22001` → 400, `23505` → 409, `55P03`/`40P01`/`40001`/`57014` → 409,
`ECONNREFUSED`/`ECONNRESET`/`57P01`/`53300` → 503. Error handler tidak menampilkan SQL,
nama constraint, password, atau stack trace ke client.

DELETE penawaran yang telah dirujuk `detail_pesanan` ditolak 409 `REFERENCE_CONFLICT`;
penawaran bersejarah tetap tersimpan untuk audit. Untuk menghentikan penawaran, ubah
`status`, jangan menonaktifkan foreign key.

## Perubahan kontrak dari Chapter 5

| Chapter 5 | Chapter 7 |
| --- | --- |
| `namaPemesan` bebas pada request pesanan | `emailPembeli` mencari akun `pengguna` berperan `pembeli` |
| ID pesanan UUID | ID `BIGINT` identity dikirim sebagai string digit |
| `penawaranId` number | `penawaranId` string digit (aman untuk `BIGINT`) |
| Data dari array `src/data/store.js` | Data dari PostgreSQL `sisabaik_dev` |

`namaPemesan` pada response dibaca dari `nama_lengkap` akun pembeli, bukan dari request.

## Batas lingkungan latihan

Belum ada login, otorisasi, pembayaran, pembatalan pesanan, maupun endpoint `pengambilan`.
Server hanya mendengarkan `127.0.0.1`, memakai data fiktif, dan tidak boleh di-deploy atau
dibuka ke jaringan publik. Konfigurasi lokal ada di `.env` yang diabaikan Git; `.env.example`
hanya berisi contoh tanpa rahasia.
