import roti from "../assets/food-bread.svg";
import siapSaji from "../assets/food-bowl.svg";
import bahanSegar from "../assets/food-produce.svg";

const kategori = {
  roti: { label: "Roti & kue", gambar: roti, nada: "hangat" },
  "makanan-siap-saji": {
    label: "Makanan siap saji",
    gambar: siapSaji,
    nada: "hijau",
  },
  "bahan-segar": { label: "Bahan segar", gambar: bahanSegar, nada: "segar" },
};

export function visualKategori(nilai) {
  return kategori[nilai] ?? { label: nilai, gambar: siapSaji, nada: "hijau" };
}

export function labelStatus(nilai) {
  return (
    {
      aktif: "Aktif",
      draft: "Draft",
      habis: "Stok habis",
      kedaluwarsa: "Kedaluwarsa",
      ditutup: "Ditutup",
    }[nilai] ?? String(nilai ?? "").replaceAll("-", " ")
  );
}

export function sisaWaktu(iso, sekarang) {
  const menit = Math.ceil((Date.parse(iso) - sekarang) / 60000);
  if (!Number.isFinite(menit) || menit <= 0) return "Waktu berakhir";
  if (menit < 60) return `${menit} menit lagi`;
  if (menit < 1440) return `${Math.ceil(menit / 60)} jam lagi`;
  return `${Math.ceil(menit / 1440)} hari lagi`;
}

export function labelPesanan(p) {
  if (p.status === "dibatalkan") {
    if (p.jenisPembatalan === "ditolak-penyedia") return "Ditolak penyedia";
    if (p.jenisPembatalan === "penyedia") return "Dibatalkan penyedia";
    return "Dibatalkan pembeli";
  }
  return {
    "menunggu-konfirmasi": "Menunggu konfirmasi",
    dikonfirmasi: "Diterima penyedia",
    "siap-diambil": "Siap diambil",
    selesai: "Selesai",
  }[p.status] ?? String(p.status || "").replaceAll("-", " ");
}

export function labelPembayaran(p) {
  const s = p.statusPembayaran || p.pembayaran?.status;
  if (s === "gratis") return "Gratis, tanpa pembayaran";
  if (s === "dibayar") return "Pembayaran di tempat diterima";
  return "Bayar di tempat saat pengambilan";
}
