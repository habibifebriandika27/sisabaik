# Hasil Uji Chapter 9 — Frontend Vue SisaBaik

Tanggal pengujian: 5 November 2026

| Item | Nilai |
| --- | --- |
| Penguji | habibifebriandika27 |
| Branch | `feature/auth-rbac` (working tree; belum dibuat branch `feature/vue-components`) |
| Commit acuan | `d0ad3e9` + perubahan frontend Chapter 9 yang belum di-commit |
| Node.js | v26.13.0 |
| npm | 11.20.0 |
| Browser uji | Chrome for Testing 156.0.8078.4 (headless, Playwright 1.64.1) |
| Server development | `http://127.0.0.1:5173` |
| Server preview | `http://127.0.0.1:4173` |
| Hasil | **50/50 pemeriksaan lulus** |

Data uji berasal dari enam fixture di memori. Browser tidak memanggil REST API dan tidak memakai PostgreSQL.
Pemilih Tampilan hanyalah state lokal, bukan autentikasi atau otorisasi.

## Aliran props dan emits yang diuji

1. `App.vue` menjadi pemilik `penawaran`, `pencarian`, `kategori`, `modeTampilan`, dan `pilihanId`.
2. `FilterPenawaran` menerima `pencarian`, `kategori`, dan `daftarKategori` melalui props. Ketikan mengirim
   `ubah-pencarian`; perubahan select mengirim `ubah-kategori`; tombol reset mengirim `reset`.
3. `KartuPenawaran` menerima `penawaran`, `waktuSekarang`, dan `bolehPilih`. Tombol Pilih mengirim `pilih` berisi
   ID penawaran. Kartu tidak mengubah stok.
4. `FormPenawaran` mengelola state lokalnya sendiri, memvalidasi dengan `validasiForm`, lalu mengirim `simpan`
   hanya ketika payload valid. `App` menambahkan ID, `penyediaId`, `penyedia`, dan `dibuatPada`.
5. `App` menangani event anak dan menghitung ulang `katalog`, `milikRina`, `milikTersedia`, `jumlahUnit`,
   `jumlahUnitMilik`, serta `jumlahPenyedia`.

## Hasil skenario aktual

| Skenario | Hasil aktual |
| --- | --- |
| Halaman baru, mode pembeli | 3 kartu; 15 unit; 2 penyedia |
| Pencarian `LAPAU` | 2 kartu: Nasi Padang Hemat dan Sayur Layak Olah |
| Pencarian `tidak-ada-produk` | Empty state tampil; teks `0 penawaran cocok.` |
| Reset filter lalu kategori roti | 1 kartu: Paket Roti Sore |
| Pilih Paket Roti Sore | Panel Pilihan Anda tampil dan mendapat fokus; stok tetap `6 paket`; pesan `Pilihan Anda diperbarui.` |
| Beralih ke mode penyedia | 3 kartu Rina; 2 tersedia; 9 unit; Draft Paket Besok tetap tampil |
| Submit form kosong | Notice kesalahan tampil dan mendapat fokus; daftar tetap 3 |
| Harga normal 20000 dan penawaran 30000 | Pesan `Harga penawaran tidak boleh melebihi harga normal.`; daftar tetap 3 |
| Paket Gratis Latihan, harga normal 20000, penawaran 0, stok 2, status aktif, waktu besok | Daftar bertambah; ringkasan penyedia menjadi 4/3/11; isian nama kembali kosong; pesan `Penawaran ditambahkan ke daftar Anda.` |
| Kembali ke pembeli dan reset filter | 4 kartu; 17 unit; 2 penyedia |
| Beralih lagi ke penyedia | Form kosong; data baru masih ada |
| Refresh browser | Kembali ke 3 kartu; 15 unit; 2 penyedia |
| Logo, ilustrasi, badge | 7 dari 7 gambar tampil; Sayur Layak Olah berlabel `Gratis`; potensi hemat Paket Roti Sore `Rp 15.000 per paket` |
| Validasi stok `1.5` | Ditolak: `stok wajib bilangan bulat 0 sampai 2147483647.`; daftar tetap 4 |
| Validasi harga kosong | Ditolak: `hargaNormal wajib bilangan bulat 1 sampai 999999999999.`; daftar tetap 4 |
| Validasi tanggal kemarin | Ditolak: `Pilih tanggal dan jam yang masih di masa depan.`; daftar tetap 4 |
| Validasi nama `ab` | Ditolak: `nama harus 3 sampai 120 karakter.`; daftar tetap 4 |
| Viewport 375, 768, dan 1280 px | Tidak ada scroll horizontal pada ketiganya |
| Tab pertama | Fokus berpindah ke `Lewati ke konten`; tautan terlihat saat fokus |
| Preview `4173` | 3 kartu awal tampil |
| Console browser | Tidak ada error atau peringatan, termasuk peringatan mutasi props |

Catatan: `Intl.NumberFormat("id-ID")` pada lingkungan uji menghasilkan teks `Rp 15.000` (ada spasi setelah `Rp`).
Nilai tersebut adalah potensi hemat per satuan, bukan penghematan transaksi selesai.

## Perhitungan ringkasan

Pembeli memakai seluruh `penawaranTersedia`:

- Penawaran tersedia: 3 → setelah menambah satu penawaran menjadi 4.
- Unit tersedia: 6 + 4 + 5 = 15 → setelah menambah 2 unit menjadi 17.
- Penyedia: `Set` atas `penyediaId` berisi 2 penyedia.

Penyedia memakai `milikRina` (`penyediaId === "1"`):

- Semua penawaran Rina: 3, termasuk satu draft.
- Penawaran tersedia: 2 (Nasi Padang Hemat dan Sayur Layak Olah).
- Unit tersedia: 4 + 5 = 9 → setelah menambah 2 unit menjadi 11.

## Build

Perintah `npm run build` berhasil. Keluaran lengkap ada di [`build-chapter9.txt`](build-chapter9.txt).

```
vite v8.3.3 building client environment for production...
✓ 23 modules transformed.
dist/assets/brand-mark-t_q2SSE9.svg    0.51 kB
dist/index.html                        0.72 kB
dist/assets/index-Do9ApoBZ.css        11.72 kB
dist/assets/index-Dl2c1TnV.js        100.49 kB
✓ built in 152ms
```

Ilustrasi kategori yang berukuran kecil disisipkan Vite sebagai data URI di bundel; logo tetap menjadi berkas SVG
terpisah di `dist/assets`. Build membuktikan kompilasi SFC dan resolusi import berjalan, tetapi bukan pengganti uji
interaksi browser.

## Bukti tangkapan layar

- [`screenshots/01-katalog-1280.png`](screenshots/01-katalog-1280.png) — katalog pembeli 1280 px.
- [`screenshots/02-empty-state.png`](screenshots/02-empty-state.png) — pencarian tanpa hasil.
- [`screenshots/03-pilihan-pembeli.png`](screenshots/03-pilihan-pembeli.png) — panel Pilihan Anda setelah kartu dipilih.
- [`screenshots/04-form-invalid.png`](screenshots/04-form-invalid.png) — form kosong dengan ringkasan kesalahan.
- [`screenshots/05-form-valid-penyedia.png`](screenshots/05-form-valid-penyedia.png) — daftar penyedia setelah penawaran valid ditambahkan.
- [`screenshots/06-katalog-setelah-tambah.png`](screenshots/06-katalog-setelah-tambah.png) — katalog pembeli 4 kartu dan 17 unit.
- [`screenshots/07-mobile-375.png`](screenshots/07-mobile-375.png) — tampilan 375 px.

Data mentah hasil pemeriksaan tersedia di [`hasil-uji-chapter9.json`](hasil-uji-chapter9.json).

## Batas pengujian

- Belum ada request API, sesi, JWT, pesanan, pembayaran, atau pengurangan stok nyata.
- Data baru hilang setelah refresh karena hanya berada di memori.
- Pemilih mode belum menggantikan login, peran, atau verifikasi penyedia.
- Uji aksesibilitas terbatas pada label, fokus keyboard, tautan lewati, empty state, dan `aria-*`; belum merupakan
  audit WCAG lengkap.
- Folder `frontend/node_modules` dan `frontend/dist` tidak masuk Git. `frontend/package-lock.json` ikut disimpan.
