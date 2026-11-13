const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const tanggal = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatRupiah = (nilai) => {
  try {
    return rupiah.format(typeof nilai === "string" ? BigInt(nilai) : nilai);
  } catch {
    return rupiah.format(Number(nilai) || 0);
  }
};
export const formatWaktu = (iso) => (iso ? tanggal.format(new Date(iso)) : "-");

export function tersedia(penawaran, waktuSekarang) {
  return (
    penawaran.status === "aktif" &&
    penawaran.stok > 0 &&
    Date.parse(penawaran.berakhirPada) > waktuSekarang
  );
}
