# Hasil Uji Chapter 8 — SisaBaik API

Dokumen ini mencatat hasil **aktual** yang dapat dijalankan pada lingkungan ini. Uji
integrasi yang membutuhkan PostgreSQL belum dijalankan karena lingkungan saat ini tidak
memiliki server PostgreSQL, `psql`, maupun Docker. Bagian yang belum dijalankan ditandai
jelas agar tidak disalahartikan sebagai lulus.

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
| PostgreSQL | **tidak tersedia** (tidak ada service, `psql`, atau Docker) |
| Database target | `sisabaik_dev` (belum dapat diakses) |
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
berlabel *belum dijalankan* memerlukan `sisabaik_dev` dan server aktif.

| Skenario | Ekspektasi | Hasil aktual / status |
| --- | --- | --- |
| Migrasi `07_auth.sql` | Dua kolom bertambah, jumlah pesanan tetap | **Belum dijalankan** — PostgreSQL tidak tersedia |
| Registrasi pembeli valid | 201, peran `pembeli`, hash tersimpan | **Belum dijalankan** |
| Registrasi penyedia valid | 201, profil `menunggu` dalam satu transaksi | **Belum dijalankan** |
| Registrasi menyisipkan `peran`/`statusVerifikasi`/`penyediaId` | 400, tidak ada akun baru | **Terverifikasi di validasi unit**; integrasi DB belum |
| Registrasi email ganda | 409 `REGISTRATION_CONFLICT` | **Belum dijalankan** |
| Login benar | 200, JWT + identitas aman | **Belum dijalankan** |
| Login salah / email tidak dikenal | 401 `LOGIN_FAILED`, body sama | **Belum dijalankan** |
| Penyedia belum disetujui | 403 `PROVIDER_NOT_VERIFIED` pada operasi bisnis | **Belum dijalankan** |
| `GET /api/auth/saya` tanpa token | 401 `AUTH_REQUIRED` | **Lulus** (uji perakitan app) |
| `GET /api/auth/saya` token rusak | 401 `TOKEN_INVALID` | **Lulus** (uji perakitan app) |
| Token kedaluwarsa | 401 `TOKEN_EXPIRED` | **Lulus di uji unit JWT**; integrasi HTTP belum |
| Logout lalu token lama dipakai | 401 `SESSION_REVOKED` | **Belum dijalankan** |
| Pembeli membuat penawaran | 403 `ROLE_FORBIDDEN` | **Belum dijalankan** |
| Penyedia membuat pesanan | 403 `ROLE_FORBIDDEN` | **Belum dijalankan** |
| Body penawaran memuat `penyediaId` | 400 | **Terverifikasi di validasi unit** |
| Body pesanan memuat `emailPembeli` | 400 | **Terverifikasi di validasi unit** |
| Penyedia lain mengubah/menghapus penawaran | 404, data tetap | **Belum dijalankan** |
| Pembeli lain membaca pesanan | 404 | **Belum dijalankan** |
| `COUNT` dan `SELECT` daftar pesanan | Cakupan sama, metadata benar | **Belum dijalankan** |
| Draft di katalog publik | 404 / tidak muncul | **Belum dijalankan** |
| Katalog publik | Hanya aktif, stok > 0, belum berakhir, penyedia terverifikasi | **Belum dijalankan** |
| Mutasi sah oleh pemilik | 200/201/204, data berubah | **Belum dijalankan** |
| Hapus penawaran bersejarah | 409 `REFERENCE_CONFLICT` | **Belum dijalankan** |
| Snapshot harga | Harga pesanan lama tidak berubah | **Belum dijalankan** |
| Batas login 20 gagal | 429 `AUTH_RATE_LIMIT` + `Retry-After` | **Belum dijalankan** |
| Batas registrasi 50 | 429 `REGISTRATION_RATE_LIMIT` + `Retry-After` | **Belum dijalankan** |
| Akun dinonaktifkan | Token lama dan login ditolak 401 | **Belum dijalankan** |

## Cara melanjutkan uji integrasi

1. Pasang/hidupkan PostgreSQL lokal dan buat database `sisabaik_dev` dengan skema Chapter 6.
2. Dari `sisabaik-api`, salin `.env.example` menjadi `.env`, isi `PGPASSWORD` dan
   `JWT_SECRET` 64 digit hex acak.
3. Terapkan migrasi:

   ```
   psql -h localhost -U postgres -d sisabaik_dev -v ON_ERROR_STOP=1 -f database/07_auth.sql
   ```

4. Jalankan server pada satu terminal:

   ```
   npm run dev
   ```

5. Jalankan uji otomatis pada terminal kedua:

   ```
   npm run auth:test
   ```

6. Lengkapi tabel di atas dengan status, `error.code`, dan efek database yang benar-benar
   diperoleh. Jangan menyalin ekspektasi sebagai hasil.

## Bukti yang harus dicatat setelah uji integrasi

- Output `npm run auth:test` yang berakhir `PASS: ...` beserta ID penawaran dan pesanan
  aktual.
- `SELECT` kolom `pengguna` tanpa menampilkan `kata_sandi_hash` atau token.
- Jumlah pesanan sebelum/sesudah migrasi.
- Perubahan `versi_token` sebelum dan sesudah logout.
- Row penawaran/pesanan yang tetap utuh setelah request 403/404.
- Tangkapan layar halaman `auth.html` yang tidak menampilkan JWT atau password.

## Refleksi

Kode Chapter 8 dapat diperiksa secara statis dan alur HTTP-nya dapat diuji tanpa database.
Namun autentikasi yang sesungguhnya bergantung pada data akun, hash, versi token, dan
cakupan SQL. Karena itu, klaim "lulus" untuk skenario tersebut baru sah setelah
`npm run auth:test` dijalankan pada `sisabaik_dev`.
