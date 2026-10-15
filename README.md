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
## Menjalankan proyek
Buka folder proyek di Visual Studio Code, lalu tampilkan `index.html` menggunakan Live Preview atau browser. Pada tahap
ini, formulir hanya merupakan prototipe HTML: data belum disimpan ke server atau basis data.
## Backend API (Chapter 5–7)
Backend terpisah ada di folder `sisabaik-api`. Chapter 5 menambahkan server Express dan halaman penguji di `public`,
Chapter 6 membentuk skema PostgreSQL, dan Chapter 7 menyambungkan route HTTP ke database sehingga array di
`src/data/store.js` tidak lagi diimpor route.
### Prasyarat
- Node.js 22 atau lebih baru dan npm.
- PostgreSQL lokal dengan database `sisabaik_dev` beserta enam tabel Chapter 6 (`pengguna`, `penyedia`, `penawaran`,
  `pesanan`, `detail_pesanan`, `pengambilan`). Jangan menjalankan ulang `database/01_schema.sql` karena bersifat DROP.
- Salin `.env.example` menjadi `.env`, lalu isi `PGPASSWORD` dengan password lokal. `.env` diabaikan Git.
### Menjalankan server
Seluruh perintah dijalankan dari folder `sisabaik-api`:
```
npm install
npm run db:check -- 0
npm run dev
```
Server mendengarkan `http://127.0.0.1:3000`. Halaman penguji disajikan di `/`, dan endpoint kesehatan di
`/api/health`. Server sengaja hanya mendengarkan `127.0.0.1`; jangan membuka port ke jaringan publik.
### Script uji
Jalankan server pada satu terminal, lalu pada terminal kedua:
```
npm run api:test
node scripts/uji-konkurensi.js
```
`npm run api:test` membuat penawaran fiktif, menguji CRUD, validasi, pencarian, filter, paginasi, pesanan lintas
penyedia, stok kurang, snapshot harga, dan larangan delete bersejarah. Uji hanya untuk database lokal latihan. Hasil
aktual tercatat di `sisabaik-api/docs/hasil-uji-chapter7.md`; kontrak lengkap ada di `sisabaik-api/docs/API.md`.
### Perubahan kontrak dari Chapter 5
- Request pesanan memakai `emailPembeli` (akun `pengguna` berperan `pembeli`) sebagai ganti `namaPemesan` bebas.
  `namaPemesan` pada response dibaca dari `nama_lengkap`. Email ini belum membuktikan autentikasi.
- ID penawaran dan pesanan dikirim sebagai string digit karena kolomnya `BIGINT`; nilai `NUMERIC(12,0)` dikirim sebagai
  number rupiah. Field API tetap `camelCase` meskipun kolom database `snake_case`.
- Data penawaran dan pesanan berasal dari PostgreSQL, bukan array sementara.
### Batas
Chapter ini belum memiliki login, otorisasi, pembayaran, pembatalan pesanan, maupun endpoint `pengambilan`. API hanya
untuk latihan lokal dengan data fiktif dan belum aman untuk publik.
## Integritas akademik
Pengerjaan proyek berkembang mengikuti kebijakan mata kuliah. AI generatif tidak diperkenankan pada tahap ini.
Mahasiswa wajib mampu menjelaskan setiap elemen dan atribut yang digunakan.