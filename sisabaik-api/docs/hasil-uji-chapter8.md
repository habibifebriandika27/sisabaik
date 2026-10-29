# Hasil Uji Chapter 8 — SisaBaik API

Dokumen ini mencatat hasil **aktual** yang dijalankan pada lingkungan ini. PostgreSQL 17
telah dipasang secara lokal, sehingga uji integrasi HTTP + database sudah dijalankan.
Skenario yang belum dijalankan (konsistensi daftar berisi banyak baris) ditandai jelas agar
tidak disalahartikan sebagai lulus.

## Lingkungan

| Komponen | Nilai |
| --- | --- |
| Node.js | v26.13.0 |
| npm | 11.20.0 |
| Express | 5.1.0 |
| pg | 8.16.3 |
| bcryptjs | 3.0.3 |
| jsonwebtoken | 9.0.3 |
| express-rate-limit | 8.1.0 |
| helmet | 8.1.0 |
| PostgreSQL | 17.11 (service `postgresql-x64-17`, port 5432) |
| Database target | `sisabaik_dev` (dapat diakses) |
| Branch | `feature/auth-rbac` |
| Commit kode | `88dbb2d` |
| Commit dokumentasi | commit terbaru pada branch `feature/auth-rbac` setelah `88dbb2d` |

## Pemeriksaan yang benar-benar dijalankan

| Pemeriksaan | Perintah | Hasil aktual |
| --- | --- | --- |
| Dependency | `npm install` | 100 paket terpasang; versi sesuai `package.json` |
| Sintaks seluruh JS | `node --check` pada 31 file `src`, `scripts`, `public` | OK, tidak ada error sintaks |
| Validasi input | uji unit tanpa database | OK: email lowercase, field identitas tambahan ditolak, password <15 karakter dan >72 byte ditolak, nomor telepon dinormalisasi, body `penyediaId`/`emailPembeli` ditolak |
| JWT | uji unit tanpa database | OK: round-trip `buatToken`/`verifikasiToken`, token diubah ditolak `TOKEN_INVALID`, token kedaluwarsa `TOKEN_EXPIRED`, audience salah `TOKEN_INVALID` |
| bcrypt | uji unit tanpa database | OK: hash berbeda dari password, `compare` benar/salah sesuai nilai |
| Perakitan app | server sementara pada port acak | OK: `/auth.html` 200, header keamanan Helmet ada, `/api` memakai `Cache-Control: no-store` |
| Skema dan seed | `psql -f database/01_schema.sql` lalu `02_seed.sql` | OK: enam tabel dibuat, seed 4 pengguna, 2 penyedia, 3 penawaran, 1 pesanan, 1 detail, 1 pengambilan |
| Migrasi Chapter 8 | `psql -f database/07_auth.sql` setelah seed | OK: kolom `kata_sandi_hash` dan `versi_token` bertambah; seluruh baris seed tetap utuh |
| Uji integrasi Chapter 8 | `npm run auth:test` pada server aktif | **PASS: 44 pemeriksaan**; fixture penawaran `4`, pesanan `2` |
| Akun dinonaktifkan | registrasi → login → `UPDATE pengguna SET aktif=false` → akses ulang | 401 `SESSION_REVOKED`; login ulang 401 `LOGIN_FAILED` |
| Filter katalog publik | `GET /api/penawaran?limit=50` | 200, 4 baris, tidak ada baris yang melanggar filter status/stok/berakhir |
| Token kedaluwarsa (HTTP) | token HS256 berumur 1 detik, tunggu 1,6 detik, `GET /api/auth/saya` | 401 `TOKEN_EXPIRED` |
| Batas login | 21 `POST /api/auth/login` dengan kredensial salah pada server port 3100 | 429 pertama pada request ke-21, `AUTH_RATE_LIMIT`, `Retry-After: 888` |
| Batas registrasi | 51 `POST /api/auth/registrasi` dengan body invalid pada server port 3100 | 429 pertama pada request ke-51, `REGISTRATION_RATE_LIMIT`, `Retry-After: 900` |
| Tanpa token | `GET /api/auth/saya`, `GET /api/pesanan`, `POST /api/penawaran` | 401 `AUTH_REQUIRED`, header `WWW-Authenticate: Bearer` |
| Token rusak | `GET /api/auth/saya` dengan `Bearer rusak` | 401 `TOKEN_INVALID` |
| Content-Type | `POST /api/auth/logout` tanpa `application/json` | 415 `JSON_REQUIRED` |
| Body login salah | `POST /api/auth/login` dengan email tidak valid | 400 `VALIDATION_ERROR` |
| Database mati | `GET /api/penawaran` | 503 `DATABASE_UNAVAILABLE`, bukan 500 |
| Guard CLI | `node scripts/verifikasi-penyedia.js` tanpa argumen | pesan penggunaan, exit code 1 |

Catatan: uji unit JWT/validasi/bcrypt dijalankan melalui stdin Node dengan `JWT_SECRET`
acak sementara. Tidak ada JWT, password, atau hash yang dicetak ke dokumen ini.

## Matriks skenario Chapter 8

Kolom **Hasil** hanya diisi untuk skenario yang benar-benar dijalankan. Skenario
berlabel *belum dijalankan* memerlukan data uji tambahan.

| Skenario | Ekspektasi | Hasil aktual / status |
| --- | --- | --- |
| Migrasi `07_auth.sql` | Dua kolom bertambah, jumlah pesanan tetap | **Lulus** — dua kolom ada, baris seed utuh |
| Registrasi pembeli valid | 201, peran `pembeli`, hash tersimpan | **Lulus** — 201, hash tersimpan dan berbeda dari password |
| Registrasi penyedia valid | 201, profil `menunggu` dalam satu transaksi | **Lulus** — 201, `statusVerifikasi` `menunggu` |
| Registrasi menyisipkan `peran`/`statusVerifikasi`/`penyediaId` | 400, tidak ada akun baru | **Lulus** — 400 `VALIDATION_ERROR` |
| Registrasi email ganda | 409 `REGISTRATION_CONFLICT` | **Lulus** — 409 |
| Login benar | 200, JWT + identitas aman | **Lulus** — 200, hash tidak ikut respons |
| Login salah / email tidak dikenal | 401 `LOGIN_FAILED`, body sama | **Lulus** — 401, body identik |
| Penyedia belum disetujui | 403 `PROVIDER_NOT_VERIFIED` pada operasi bisnis | **Lulus** — 403 `PROVIDER_NOT_VERIFIED` |
| `GET /api/auth/saya` tanpa token | 401 `AUTH_REQUIRED` | **Lulus** |
| `GET /api/auth/saya` token rusak | 401 `TOKEN_INVALID` | **Lulus** |
| Token kedaluwarsa | 401 `TOKEN_EXPIRED` | **Lulus** — uji unit JWT dan uji HTTP |
| Logout lalu token lama dipakai | 401 `SESSION_REVOKED` | **Lulus** — 204 saat logout, kedua token lama 401 |
| Pembeli membuat penawaran | 403 `ROLE_FORBIDDEN` | **Lulus** — 403 |
| Penyedia membuat pesanan | 403 `ROLE_FORBIDDEN` | **Lulus** — 403 |
| Body penawaran memuat `penyediaId` | 400 | **Lulus** — 400 `VALIDATION_ERROR` |
| Body pesanan memuat `emailPembeli` | 400 | **Lulus** — 400 `VALIDATION_ERROR` |
| Penyedia lain mengubah/menghapus penawaran | 404, data tetap | **Lulus** — PUT dan DELETE 404 |
| Pembeli lain membaca pesanan | 404 | **Lulus** — pembeli lain 404, penyedia terkait 200 |
| `COUNT` dan `SELECT` daftar pesanan | Cakupan sama, metadata benar | **Lulus untuk daftar kosong** (`meta.jumlah` 0); kasus banyak baris belum diuji terpisah |
| Draft di katalog publik | 404 / tidak muncul | **Lulus** — draft 404 saat diakses publik |
| Katalog publik | Hanya aktif, stok > 0, belum berakhir, penyedia terverifikasi | **Lulus** — 4 baris, 0 pelanggaran filter |
| Mutasi sah oleh pemilik | 200/201/204, data berubah | **Lulus** — 200/201/204 |
| Hapus penawaran bersejarah | 409 `REFERENCE_CONFLICT` | **Lulus** — 409 |
| Snapshot harga | Harga pesanan lama tidak berubah | **Lulus** — tetap 5000 setelah penawaran diubah ke 6000 |
| Batas login 20 gagal | 429 `AUTH_RATE_LIMIT` + `Retry-After` | **Lulus** — 429 pada request ke-21, `Retry-After` ada |
| Batas registrasi 50 | 429 `REGISTRATION_RATE_LIMIT` + `Retry-After` | **Lulus** — 429 pada request ke-51, `Retry-After` ada |
| Akun dinonaktifkan | Token lama dan login ditolak 401 | **Lulus** — 401 `SESSION_REVOKED`, login 401 `LOGIN_FAILED` |

## Cara mengulang uji integrasi

1. Pastikan service PostgreSQL berjalan dan database `sisabaik_dev` sudah ada.
2. Dari `sisabaik-api`, isi `.env` (tidak di-commit) dengan `PGPASSWORD` dan
   `JWT_SECRET` 64 digit hex acak. Nilai asli tidak dicatat di dokumen ini.
3. Terapkan skema, seed, lalu migrasi:

   ```
   psql -h localhost -U postgres -d sisabaik_dev -v ON_ERROR_STOP=1 -f database/01_schema.sql
   psql -h localhost -U postgres -d sisabaik_dev -v ON_ERROR_STOP=1 -f database/02_seed.sql
   psql -h localhost -U postgres -d sisabaik_dev -v ON_ERROR_STOP=1 -f database/07_auth.sql
   ```

   Jika `psql` belum ada di `PATH`, gunakan path lengkap
   `C:\Program Files\PostgreSQL\17\bin\psql.exe`.

4. Jalankan server pada satu terminal:

   ```
   npm run dev
   ```

5. Jalankan uji otomatis pada terminal kedua:

   ```
   npm run auth:test
   ```

6. Untuk skenario batas laju, jalankan pada proses/port terpisah agar login utama tidak
   terkunci. Akun nonaktif dan filter katalog dapat diperiksa manual. Jangan menyalin
   ekspektasi sebagai hasil.

## Bukti yang tercatat

- Output `npm run auth:test`: `PASS: 44 pemeriksaan HTTP dan assertion kepemilikan/snapshot.`
  dengan fixture penawaran `4` dan pesanan `2`.
- Jumlah baris setelah seed dan migrasi: 4 pengguna, 2 penyedia, 3 penawaran, 1 pesanan,
  1 detail pesanan, 1 pengambilan. Setelah uji: 8 pengguna, 4 penyedia, 4 penawaran,
  2 pesanan, 2 detail pesanan, 1 pengambilan (fixture uji dipertahankan).
- Empat akun uji memiliki `kata_sandi_hash`; satu akun (pembeli yang logout) memiliki
  `versi_token = 1`, sisanya `0`.
- Token berumur 1 detik menghasilkan 401 `TOKEN_EXPIRED` setelah masa berlakunya lewat.
- Batas login menghasilkan 429 `AUTH_RATE_LIMIT` pada request gagal ke-21; batas registrasi
  menghasilkan 429 `REGISTRATION_RATE_LIMIT` pada request ke-51. Keduanya menyertakan
  `Retry-After`.
- Tidak ada `kata_sandi_hash`, JWT, atau nilai secret yang dicetak ke dokumen ini.
- Tangkapan layar `auth.html` belum diambil pada sesi ini.

## Refleksi

Autentikasi, otorisasi berbasis peran, kepemilikan data, pencabutan sesi, batas laju, token
kedaluwarsa, dan snapshot harga sudah terbukti berjalan pada PostgreSQL lokal melalui 44
pemeriksaan otomatis ditambah lima pemeriksaan manual/terpisah. Satu area masih perlu data
uji tambahan: konsistensi `COUNT` terhadap `SELECT` pada daftar berisi banyak baris.
Tangkapan layar halaman `auth.html` juga belum diambil. Klaim kelulusan untuk area tersebut
sengaja belum dibuat.
