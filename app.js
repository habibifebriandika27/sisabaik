"use strict";

const rupiah = new Intl.NumberFormat("id-ID", {
style: "currency",
currency: "IDR",
maximumFractionDigits: 0
});

document.addEventListener("DOMContentLoaded", () => {
siapkanKatalog();
siapkanValidasiPenawaran();
});

async function siapkanKatalog() {
const wadah = document.querySelector("#daftar-penawaran");
if (!wadah) return;

const status = document.querySelector("#status-katalog");
const inputCari = document.querySelector("#kata-kunci");
const pilihKategori = document.querySelector("#filter-kategori");
const keranjang = [];

try {
const respons = await fetch("data/penawaran.json");
if (!respons.ok) throw new Error(`HTTP ${respons.status}`);
const penawaran = await respons.json();

function perbaruiTampilan() {
const kata = inputCari.value.trim().toLowerCase();
const kategori = pilihKategori.value;
const hasil = penawaran.filter((item) => {
const cocokKata = `${item.nama} ${item.penyedia}`.toLowerCase().includes(kata);
const cocokKategori = kategori === "semua" || item.kategori === kategori;
return cocokKata && cocokKategori;
});
renderKartu(hasil, wadah, status, keranjang);
}

inputCari.addEventListener("input", perbaruiTampilan);
pilihKategori.addEventListener("change", perbaruiTampilan);
perbaruiTampilan();
} catch (error) {
status.textContent = "Data gagal dimuat. Jalankan proyek melalui server lokal.";
status.classList.add("error-message");
console.error("Gagal memuat penawaran:", error);
}
}

function renderKartu(data, wadah, status, keranjang) {
wadah.replaceChildren();
status.textContent = `${data.length} penawaran ditemukan.`;
data.forEach((item) => {
const artikel = document.createElement("article");
artikel.className = "offer-card";
artikel.innerHTML = `
<div class="offer-card  visual" aria-hidden="true"></div>
<div class="offer-card  content">
<span class="badge">${item.labelKategori}</span>
<h3>${item.nama}</h3>
<p class="offer-card  meta">${item.penyedia} · ${item.stok} ${item.satuan}</p>
<p class="offer-card  price"><del>${rupiah.format(item.hargaNormal)}</del>
<strong>${item.hargaPenawaran === 0 ? "Tanpa biaya" : rupiah.format(item.hargaPenawaran)}</strong></p>
<button class="button" type="button" data-id="${item.id}">Tambah</button>
</div>`;
artikel.querySelector("button").addEventListener("click", () => {
keranjang.push(item);
perbaruiRingkasan(keranjang);
});
wadah.append(artikel);
});
}

function perbaruiRingkasan(keranjang) {
const total = keranjang.reduce((jumlah, item) => jumlah + item.hargaPenawaran, 0);
document.querySelector("#jumlah-item").textContent = keranjang.length;
document.querySelector("#total-pesanan").textContent = rupiah.format(total);
}

function siapkanValidasiPenawaran() {
const form = document.querySelector("#form-penawaran");
if (!form) return;
const normal = form.querySelector("#harga-normal");
const penawaran = form.querySelector("#harga-pemulihan");
const batasAmbil = form.querySelector("#batas-pengambilan");

function validasiHarga() {
const hargaNormal = Number(normal.value);
const hargaPenawaran = Number(penawaran.value);
penawaran.setCustomValidity(
hargaPenawaran > hargaNormal ? "Harga penawaran tidak boleh melebihi harga normal." : ""
);
}

function validasiBatasWaktu() {
const waktuAmbil = new Date(batasAmbil.value);
batasAmbil.setCustomValidity(
batasAmbil.value && waktuAmbil <= new Date()
? "Batas waktu pengambilan harus berada di masa depan."
: ""
);
}

normal.addEventListener("input", validasiHarga);
penawaran.addEventListener("input", validasiHarga);
batasAmbil.addEventListener("input", validasiBatasWaktu);

form.addEventListener("submit", (event) => {
validasiHarga();
validasiBatasWaktu();
if (!form.checkValidity()) {
event.preventDefault();
form.reportValidity();
}
});
}