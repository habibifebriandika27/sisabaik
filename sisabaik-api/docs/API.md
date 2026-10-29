# Kontrak API SisaBaik — Chapter 8

Server latihan: `http://127.0.0.1:3000` (bind `127.0.0.1`, hanya perangkat sendiri).
Sumber data: PostgreSQL `sisabaik_dev` (skema Chapter 6 + migrasi `database/07_auth.sql`).
Frontend penguji dan API berada pada origin yang sama sehingga CORS tidak dipakai.

Model response tetap memakai envelope Chapter 7:

```json
{ "success": true, "data": {}, "meta": {} }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

`meta` hanya muncul pada koleksi terpaginasi (`jumlah`, `page`, `limit`, `totalPages`).
`meta.jumlah` adalah total row yang cocok dengan filter **dan** cakupan pengguna, bukan
jumlah row pada halaman saat ini.

## Identitas, peran, dan kepemilikan

- `pengguna.id` adalah ID akun. `penyedia.id` adalah ID profil usaha, dan
  `penyedia.pengguna_id` menghubungkan profil ke akun. Ketiganya tidak boleh dianggap sama.
- Peran tetap `pembeli` dan `penyedia`. Tidak ada peran admin pada API.
- `pengguna.id` yang dipercaya berasal dari JWT yang sudah diverifikasi, bukan dari body.
- `penyedia.id` yang dipercaya berasal dari hubungan `pengguna.id → penyedia.pengguna_id`.
- Izin mengelola penawaran dan membaca pesanan penyedia memerlukan
  `penyedia.status_verifikasi = 'terverifikasi'`.

## Daftar endpoint

| Method | Path | Akses | Response berhasil |
| --- | --- | --- | --- |
| GET | `/api/health` | Publik | 200, status proses dan database |
| POST | `/api/auth/registrasi` | Publik; rate limit registrasi | 201, akun `pembeli` tanpa hash/token |
| POST | `/api/auth/registrasi-penyedia` | Publik; rate limit registrasi | 201, akun `penyedia` + profil `menunggu` dalam satu transaksi |
| POST | `/api/auth/login` | Publik; rate limit login | 200, `accessToken`, `tokenType`, `expiresIn`, `pengguna` |
| GET | `/api/auth/saya` | Login | 200, identitas aman dari database |
| POST | `/api/auth/logout` | Login; body `{}` | 204, seluruh token versi lama dicabut |
| GET | `/api/penawaran` | Publik | 200, katalog aktif yang tersedia |
| GET | `/api/penawaran/:id` | Publik | 200 untuk penawaran tersedia; 404 untuk yang tidak terlihat |
| GET | `/api/penawaran/milik-saya` | Penyedia terverifikasi | 200, semua status milik sendiri |
| POST | `/api/penawaran` | Penyedia terverifikasi | 201, `penyediaId` ditentukan server |
| PUT | `/api/penawaran/:id` | Penyedia terverifikasi dan pemilik | 200, seluruh field bisnis wajib dikirim |
| DELETE | `/api/penawaran/:id` | Penyedia terverifikasi dan pemilik | 204; 409 bila sudah dirujuk riwayat pesanan |
| GET | `/api/pesanan` | Pembeli atau penyedia terverifikasi | 200, hanya pesanan dalam cakupan pengguna |
| GET | `/api/pesanan/:id` | Pembeli atau penyedia terverifikasi | 200, hanya bila pengguna berhak |
| POST | `/api/pesanan` | Pembeli | 201, `pembeliId` ditentukan server |

Tidak ada endpoint `PATCH`, `PUT /api/pesanan/:id`, `DELETE /api/pesanan/:id`,
`pengambilan`, pembayaran, reset password, verifikasi email, MFA, atau refresh token pada
chapter ini.

## Header autentikasi

```http
Authorization: Bearer <accessToken>
```

Token diterbitkan oleh `POST /api/auth/login`. Server memeriksa signature HS256,
algoritma, `issuer`, `audience`, `exp`, claim `sub`, dan versi token `v`. Token tidak
memuat password, hash, atau isi pesanan. Masa berlaku 15 menit. Setelah logout, token
dengan versi lama ditolak meskipun belum kedaluwarsa.

## Body pendaftaran pembeli

```json
{
  "namaLengkap": "Siti Baru",
  "email": "siti.baru@example.test",
  "kataSandi": "kata-sandi-pilihan-saya"
}
```

| Field | Aturan |
| --- | --- |
| `namaLengkap` | string 2–100 karakter |
| `email` | format email, 3–254 karakter, dinormalisasi trim + lowercase |
| `kataSandi` | string minimal 15 karakter, maksimal 72 byte UTF-8, tidak di-trim |

Field `peran`, `penyediaId`, `statusVerifikasi`, `aktif`, atau field lain ditolak 400.
Server selalu menetapkan peran `pembeli`.

## Body pendaftaran penyedia

```json
{
  "namaLengkap": "Rina Baru",
  "email": "rina.baru@example.test",
  "kataSandi": "kata-sandi-pilihan-saya",
  "namaUsaha": "Dapur Rina",
  "alamat": "Jl. Kampus No. 8, Padang",
  "nomorTelepon": "+62 812-3456-7890"
}
```

| Field | Aturan |
| --- | --- |
| `namaLengkap`, `email`, `kataSandi` | sama dengan pendaftaran pembeli |
| `namaUsaha` | string 2–120 karakter |
| `alamat` | string 5–1000 karakter |
| `nomorTelepon` | 8–30 karakter input; setelah spasi, `-`, dan `()` dibersihkan harus 8–15 digit dengan tanda `+` opsional di awal |

Server membuat akun `penyedia` dan profil `penyedia` berstatus `menunggu` dalam satu
transaksi. Bila pembuatan profil gagal, akun dibatalkan. Penyedia yang menunggu atau
ditolak tetap dapat login dan membaca `/api/auth/saya`, tetapi operasi bisnis penyedia
ditolak `403 PROVIDER_NOT_VERIFIED`.

## Body login dan logout

```json
{ "email": "rina.baru@example.test", "kataSandi": "kata-sandi-pilihan-saya" }
```

Response login:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "pengguna": {
      "id": "9",
      "namaLengkap": "Rina Baru",
      "email": "rina.baru@example.test",
      "peran": "penyedia",
      "penyediaId": "5",
      "statusVerifikasi": "menunggu",
      "namaUsaha": "Dapur Rina",
      "alamatUsaha": "Jl. Kampus No. 8, Padang",
      "nomorTeleponUsaha": "+6281234567890"
    }
  }
}
```

`POST /api/auth/logout` memerlukan header Bearer dan body JSON `{}` (karena middleware
mewajibkan `application/json` untuk POST). Response `204` tanpa body. Logout menaikkan
`pengguna.versi_token`, sehingga semua token yang sudah diterbitkan untuk akun tersebut
ditolak pada request terlindungi berikutnya, termasuk token dari tab lain.

## Katalog publik dan penawaran

`GET /api/penawaran` hanya mengembalikan penawaran yang memenuhi seluruh syarat:

- `status = 'aktif'`
- `stok > 0`
- `berakhir_pada > CURRENT_TIMESTAMP`
- pemilik akun `aktif = TRUE` dan `peran = 'penyedia'`
- `penyedia.status_verifikasi = 'terverifikasi'`

Query `q`, `kategori`, `page`, dan `limit` tetap didukung. Bila dikirim, `status` harus
`aktif` dan `tersedia` harus `true`; `status=draft` atau `tersedia=false` ditolak 400.
Pemilik memakai `/api/penawaran/milik-saya` untuk melihat seluruh status miliknya.
Route `/milik-saya` ditulis sebelum `/:id` agar tidak dianggap sebagai ID.

`GET /api/penawaran/:id` memakai aturan keterlihatan publik yang sama. Penawaran draft,
habis, kedaluwarsa, atau milik penyedia yang belum terverifikasi menghasilkan 404 pada
katalog/detail publik.

### Body POST/PUT penawaran

```json
{
  "nama": "Paket Roti Sore",
  "kategori": "roti",
  "hargaNormal": 30000,
  "hargaPenawaran": 15000,
  "stok": 6,
  "satuan": "paket",
  "status": "aktif",
  "berakhirPada": "2026-10-30T10:00:00.000Z"
}
```

`penyediaId` **tidak boleh** dikirim; server mengambilnya dari profil akun yang login.
Field `id`, `dibuatPada`, atau field tak dikenal ditolak 400. PUT mengganti seluruh field
bisnis yang dapat diedit; ID yang tidak ada atau milik penyedia lain menghasilkan 404.

## Body POST pesanan

```json
{ "items": [{ "penawaranId": "12", "kuantitas": 1 }] }
```

`pembeliId` **tidak boleh** dikirim; server memakai ID akun pembeli yang terautentikasi.
Field `emailPembeli` dari Chapter 7 ditolak 400. `items` berisi 1–10 item dengan
`penawaranId` unik dan `kuantitas` 1–1000. Seluruh item harus dari satu penyedia
(`409 MIXED_PROVIDER` bila berbeda). Service tetap mengunci baris penawaran, memeriksa
status/waktu/stok, menyimpan snapshot harga, dan memakai transaksi stok Chapter 7.
Penawaran dari penyedia yang belum terverifikasi tidak dapat dipesan.

## Cakupan daftar dan detail pesanan

| Peran | Cakupan |
| --- | --- |
| `pembeli` | `pesanan.pembeli_id = pengguna.id` |
| `penyedia` terverifikasi | `pesanan.penyedia_id = pengguna.penyediaId` |

`COUNT` dan `SELECT` halaman memakai cakupan yang sama. Pembeli lain atau penyedia lain
yang menebak ID pesanan menerima 404. Penyedia tidak dapat membuat pesanan sebagai
pembeli (`403 ROLE_FORBIDDEN`).

## Status dan kode kesalahan

| Status | Kode contoh | Makna |
| --- | --- | --- |
| 200 | — | Pembacaan/perubahan berhasil |
| 201 | — | Resource baru dibuat (disertai `Location`) |
| 204 | — | Logout/penghapusan berhasil tanpa body |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `DATA_CONSTRAINT` | Body/field/parameter tidak sesuai kontrak |
| 401 | `AUTH_REQUIRED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `SESSION_REVOKED`, `LOGIN_FAILED` | Belum login, token tidak valid/kedaluwarsa/dicabut, atau login gagal |
| 403 | `ROLE_FORBIDDEN`, `PROVIDER_NOT_VERIFIED` | Identitas valid tetapi peran/profil tidak diizinkan |
| 404 | `OFFER_NOT_FOUND`, `ORDER_NOT_FOUND`, `BUYER_NOT_FOUND`, `PROVIDER_NOT_FOUND`, `ROUTE_NOT_FOUND` | Resource tidak ada atau tidak terlihat dalam cakupan pengguna |
| 409 | `REGISTRATION_CONFLICT`, `INSUFFICIENT_STOCK`, `OFFER_UNAVAILABLE`, `MIXED_PROVIDER`, `PROVIDER_IMMUTABLE`, `ORDER_TOTAL_LIMIT`, `REFERENCE_CONFLICT`, `DATA_CONFLICT`, `TRANSACTION_BUSY` | Konflik state, pendaftaran, atau relasi |
| 413 | `PAYLOAD_TOO_LARGE` | Payload melebihi 20 KB |
| 415 | `JSON_REQUIRED` | POST/PUT bukan `application/json` |
| 429 | `AUTH_RATE_LIMIT`, `REGISTRATION_RATE_LIMIT` | Batas percobaan tercapai; ikuti `Retry-After` |
| 500 | `INTERNAL_SERVER_ERROR` | Kegagalan server tak terduga |
| 503 | `DATABASE_UNAVAILABLE` | Database belum dapat diakses |

Login dengan email tidak dikenal, password salah, akun nonaktif, atau akun tanpa hash
memakai response 401 yang sama. Hash dummy tetap dibandingkan saat akun tidak ditemukan.
Route terlindungi mengirim `WWW-Authenticate: Bearer` pada response 401.

SQLSTATE PostgreSQL tetap dipetakan stabil: `23503`/`23001` → 409,
`23514`/`23502`/`22003`/`22007`/`22008`/`22001` → 400, `23505` → 409,
`55P03`/`40P01`/`40001`/`57014` → 409, `ECONNREFUSED`/`ECONNRESET`/`57P01`/`53300` → 503.
Error handler tidak menampilkan SQL, nama constraint, password, hash, token, atau stack
trace ke client.

## Batas laju

| Endpoint | Batas | Kode 429 |
| --- | --- | --- |
| `POST /api/auth/login` | 20 request gagal per 15 menit per alamat IP; login berhasil dikurangi dari hitungan | `AUTH_RATE_LIMIT` |
| `POST /api/auth/registrasi` dan `/registrasi-penyedia` | 50 request per 15 menit per alamat IP, termasuk pendaftaran berhasil | `REGISTRATION_RATE_LIMIT` |

Keduanya memakai memory store per proses; beberapa instance memerlukan penyimpanan
bersama. Response 429 menyertakan header `Retry-After`.

## Keamanan dan rahasia

- `JWT_SECRET` wajib 64 digit hex (32 byte acak) dan hanya berada di `.env` yang diabaikan
  Git. `.env.example` memuat nama variabel dengan nilai kosong.
- Response identitas memakai daftar field aman; `kata_sandi_hash` dan `versi_token` tidak
  pernah dikirim ke client.
- Password di-hash dengan bcrypt (cost 12). Input baru minimal 15 karakter dan maksimal
  72 byte UTF-8.
- Logger hanya mencatat method, path, status, dan durasi; tidak mencatat body, header
  `Authorization`, password, atau JWT.
- API memakai `Cache-Control: no-store` dan header keamanan Helmet. HSTS dan
  `upgrade-insecure-requests` dinonaktifkan untuk latihan HTTP lokal.
- Halaman latihan menyimpan token di variabel memori, bukan `localStorage`,
  `sessionStorage`, cookie, atau URL.

## Perubahan kontrak dari Chapter 7

| Chapter 7 | Chapter 8 |
| --- | --- |
| Request pesanan memakai `emailPembeli` | Body pesanan hanya `items`; `pembeliId` dari token |
| Body penawaran memakai `penyediaId` | `penyediaId` dari hubungan akun → profil |
| Semua route bisnis terbuka | Mutasi penawaran dan pesanan memerlukan login/peran/pemilik |
| Katalog menampilkan semua status bila diminta | Katalog publik hanya penawaran aktif yang tersedia dan penyedia terverifikasi |
| Daftar pesanan menampilkan semua pesanan | Daftar/detail dibatasi cakupan pembeli/penyedia |
| Belum ada akun/login | Registrasi mandiri, login, JWT, logout semua sesi |

## Batas lingkungan latihan

Chapter 8 menyelesaikan fondasi akun dan otorisasi. Belum ada peran admin, panel admin,
pembayaran, pembatalan, konfirmasi/serah terima, endpoint `pengambilan`, foto opsional,
reset password, verifikasi email, MFA, atau refresh token. API hanya untuk latihan lokal
dengan data fiktif dan belum aman untuk publik.
