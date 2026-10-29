# SisaBaik

SisaBaik adalah proyek berkembang pada mata kuliah Pengembangan Web. Aplikasi ini dirancang untuk membantu penyedia
memulihkan nilai stok makanan berlebih melalui penjualan dengan harga khusus atau penyaluran, sekaligus membantu
masyarakat memperoleh makanan yang lebih terjangkau dan mengurangi limbah pangan.

## Capaian Chapter 3

- Mempertahankan semantic HTML dan formulir aksesibel dari Chapter 2.
- Menerapkan CSS cascade, box model, dan custom properties.
- Menggunakan Flexbox untuk navigasi dan kelompok tombol.
- Menggunakan Grid untuk kartu penawaran dan bagian halaman.
- Membangun layout mobile-first dengan media queries.
- Memeriksa kontras, fokus keyboard, reflow, dan konsistensi visual.

## Halaman

- `index.html`: halaman informasi SisaBaik.
- `daftar-penyedia.html`: formulir pendaftaran penyedia.
- `tawarkan-makanan.html`: formulir penawaran makanan berlebih.
- `styles.css`: sistem visual dan layout responsif untuk seluruh halaman.

## Backend API (Chapter 5–8)

Backend terpisah ada di folder `sisabaik-api`. Chapter 5 menambahkan server Express dan halaman penguji di `public`,
Chapter 6 membentuk skema PostgreSQL, Chapter 7 menyambungkan route HTTP ke database, dan Chapter 8 menambahkan
autentikasi, otorisasi berbasis peran, serta kepemilikan data.

### Prasyarat

- Node.js 22 atau lebih baru dan npm.
- PostgreSQL lokal dengan database `sisabaik_dev` beserta enam tabel Chapter 6 (`pengguna`, `penyedia`, `penawaran`,
  `pesanan`, `detail_pesanan`, `pengambilan`). Jangan menjalankan ulang `database/01_schema.sql` karena bersifat DROP.
- Salin `sisabaik-api/.env.example` menjadi `sisabaik-api/.env`, lalu isi `PGPASSWORD` dengan password PostgreSQL
  lokal dan `JWT_SECRET` dengan 64 digit hex acak. `.env` diabaikan Git.

Membuat `JWT_SECRET` (jalankan dari root proyek; jangan bagikan hasilnya):

```
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### Migrasi Chapter 8

Dari folder `sisabaik-api`, terapkan migrasi sekali pada database yang sudah berisi data Chapter 6–7. Migrasi hanya
menambah dua kolom dan tidak menghapus tabel atau data lama:

```
psql -h localhost -U postgres -d sisabaik_dev -v ON_ERROR_STOP=1 -f database/07_auth.sql
```

Bila `psql` tidak tersedia, buka `database/07_auth.sql` melalui Query Tool pgAdmin dan jalankan. Periksa hasilnya:

```
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='pengguna'
AND column_name IN ('kata_sandi_hash','versi_token');
```

Akun seed lama tetap tersimpan, tetapi belum mempunyai hash sehingga belum dapat login. Daftarkan akun baru dengan
email yang belum dipakai; registrasi tidak mengubah akun lama. Empat akun seed tidak wajib diberi kata sandi bersama.

### Menjalankan server

Seluruh perintah dijalankan dari folder `sisabaik-api`:

```
npm install
npm run db:check -- 0
npm run dev
```

Server mendengarkan `http://127.0.0.1:3000`. Halaman penguji Chapter 7 tetap tersedia di `/`, halaman latihan
autentikasi ada di `/auth.html`, dan endpoint kesehatan di `/api/health`. Server sengaja hanya mendengarkan
`127.0.0.1`; jangan membuka port ke jaringan publik.

### Akun, login, dan peran

- `POST /api/auth/registrasi` membuat akun **pembeli** dengan kata sandi yang dipilih pengguna.
- `POST /api/auth/registrasi-penyedia` membuat akun **penyedia** beserta profil usaha berstatus `menunggu` dalam satu
  transaksi.
- `POST /api/auth/login` mengembalikan JWT berumur 15 menit. Token disimpan di memori halaman latihan dan hilang saat
  refresh.
- `GET /api/auth/saya` membaca identitas dan status terbaru dari database.
- `POST /api/auth/logout` menaikkan versi token akun sehingga **semua** token lama ditolak, termasuk token dari tab
  lain.

Penyedia yang belum ditinjau tetap dapat login dan membaca profil sendiri, tetapi belum dapat mengelola penawaran atau
membaca pesanan. Pengelola meninjau usaha melalui script operator (bukan endpoint publik):

```
npm run penyedia:verifikasi -- rina.baru@example.test
npm run penyedia:verifikasi -- rina.baru@example.test --tolak
```

Pelanggan tidak memperoleh field `peran`, `penyediaId`, atau `statusVerifikasi` pada body registrasi. Server yang
menentukan identitas, peran, dan status verifikasi.

### Kontrak bisnis Chapter 8

- Body `POST/PUT /api/penawaran` tidak memuat `penyediaId`; server mengambilnya dari profil akun yang login.
- Body `POST /api/pesanan` hanya memuat `items`; `emailPembeli` dari Chapter 7 ditolak dan `pembeliId` diambil dari
  token.
- `GET /api/penawaran` hanya menampilkan penawaran aktif, stok positif, belum berakhir, serta penyedia aktif dan
  terverifikasi.
- `GET /api/penawaran/milik-saya` menampilkan seluruh status milik penyedia yang login.
- `PUT/DELETE /api/penawaran/:id` memeriksa `penyedia_id` di query, bukan hanya di antarmuka.
- `GET /api/pesanan` dan `/api/pesanan/:id` dibatasi pada pesanan milik pembeli atau pesanan yang ditujukan kepada
  profil penyedia. `COUNT` dan `SELECT` memakai cakupan yang sama.

Kontrak lengkap ada di `sisabaik-api/docs/API.md`.

### Script uji

Jalankan server pada satu terminal, lalu pada terminal kedua dari folder `sisabaik-api`:

```
npm run auth:test
```

`npm run auth:test` membuat dua penyedia dan dua pembeli baru dengan kata sandi acak, meninjau penyedia melalui fungsi
operator, lalu memeriksa token, peran, kepemilikan, snapshot harga, logout semua sesi, dan penolakan akses. Script tidak
mencetak JWT, kata sandi, atau hash. Bila port diubah, berikan URL sebagai argumen:

```
npm run auth:test -- http://127.0.0.1:3001
```

`npm run api:test:chapter7` dan `scripts/uji-konkurensi.js` adalah bukti historis kontrak sebelum login. Keduanya akan
memperoleh 401/400 pada Chapter 8 dan tidak dipakai sebagai uji utama chapter ini.

Hasil uji aktual dicatat di `sisabaik-api/docs/hasil-uji-chapter8.md`.

### Environment variables

`.env.example` hanya memuat nama variabel tanpa nilai rahasia:

| Variabel | Keterangan |
| --- | --- |
| `PORT` | Port HTTP lokal, default 3000 |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Koneksi PostgreSQL lokal |
| `JWT_SECRET` | 64 digit hex acak; wajib, tidak boleh masuk Git atau frontend |

Jangan menaruh `JWT_SECRET` di `public`, `VITE_*`, laporan, atau screenshot. Pastikan `git check-ignore .env`
menunjukkan `.env` diabaikan.

### Batas Chapter 8

Chapter ini menyelesaikan fondasi akun dan otorisasi. Belum ada peran admin, panel admin web, pembayaran, pembatalan,
konfirmasi/serah terima, endpoint `pengambilan`, foto opsional, reset password, verifikasi email, MFA, refresh token,
maupun dashboard akhir. API hanya untuk latihan lokal dengan data fiktif dan belum aman untuk publik.

## Integritas akademik

Pengerjaan proyek berkembang mengikuti kebijakan mata kuliah. Mahasiswa wajib mampu menjelaskan setiap elemen dan
atribut yang digunakan, termasuk alur token, pemeriksaan peran, dan kepemilikan data.
