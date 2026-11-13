<script setup>
import { reactive, ref, onUnmounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import Ikon from "../components/Ikon.vue";
import { api } from "../lib/api.js";
import { periksaRegistrasi } from "../lib/registrasi.js";

const route = useRoute();
const router = useRouter();
const form = reactive({
  peran: route.query.peran === "penyedia" ? "penyedia" : "pembeli",
  namaLengkap: "",
  email: "",
  kataSandi: "",
  konfirmasiSandi: "",
  namaUsaha: "",
  alamat: "",
  nomorTelepon: "",
});
const errors = ref({});
const error = ref("");
const sibuk = ref(false);
const lihatSandi = ref(false);
const akunBaru = ref(null);
const ringkasan = ref(null);
const selesai = ref(null);
const controller = new AbortController();
onUnmounted(() => controller.abort());

async function daftar() {
  if (sibuk.value) return;
  error.value = "";
  errors.value = periksaRegistrasi(form);
  if (Object.keys(errors.value).length) {
    await nextTick();
    ringkasan.value?.focus();
    return;
  }
  const body = {
    namaLengkap: form.namaLengkap.trim(),
    email: form.email.trim(),
    kataSandi: form.kataSandi,
  };
  if (form.peran === "penyedia") {
    Object.assign(body, {
      namaUsaha: form.namaUsaha.trim(),
      alamat: form.alamat.trim(),
      nomorTelepon: form.nomorTelepon.trim(),
    });
  }
  sibuk.value = true;
  try {
    const hasil = await api(
      form.peran === "penyedia" ? "/api/auth/registrasi-penyedia" : "/api/auth/registrasi",
      { method: "POST", body, signal: controller.signal },
    );
    if (controller.signal.aborted) return;
    akunBaru.value = hasil.data;
    form.kataSandi = "";
    form.konfirmasiSandi = "";
    lihatSandi.value = false;
    await nextTick();
    selesai.value?.focus();
  } catch (e) {
    if (e.name !== "AbortError") {
      error.value =
        e.status === 409
          ? "Pendaftaran tidak dapat diproses. Jika pernah mendaftar, coba login dengan email tersebut."
          : e.status === 0
          ? "Koneksi bermasalah. Periksa koneksi dan coba kembali. Jika akun sudah terbentuk, gunakan halaman login."
          : e.message || "Pendaftaran belum berhasil. Silakan coba kembali.";
      await nextTick();
      ringkasan.value?.focus();
    }
  } finally {
    sibuk.value = false;
  }
}
</script>

<template>
  <section class="container login-layout" aria-labelledby="judul-daftar">
    <div class="login-card">
      <span class="outline-pill"><Ikon nama="pengguna" />Akun baru SisaBaik</span>
      <h1 id="judul-daftar">Daftar SisaBaik</h1>
      <p class="muted">Buat akun dengan email dan kata sandi pilihan Anda.</p>

      <div v-if="akunBaru" ref="selesai" tabindex="-1" class="notice notice-success" role="status">
        <Ikon nama="cek" />
        <div>
          <p>
            Pendaftaran berhasil untuk {{ akunBaru.email }}.
            <template v-if="akunBaru.peran === 'penyedia'"> Profil usaha Anda menunggu peninjauan pengelola.</template>
          </p>
          <RouterLink class="button" :to="{ path: '/login', query: { email: akunBaru.email } }"
            >Lanjut ke login<Ikon nama="panah"
          /></RouterLink>
        </div>
      </div>

      <form v-else class="form-login" @submit.prevent="daftar" novalidate :aria-busy="sibuk">
        <fieldset :disabled="sibuk">
          <legend>Jenis akun</legend>
          <label><input type="radio" v-model="form.peran" value="pembeli" /> Pembeli</label>
          <label><input type="radio" v-model="form.peran" value="penyedia" /> Penyedia makanan</label>
        </fieldset>

        <p ref="ringkasan" tabindex="-1" role="alert" v-if="error || Object.keys(errors).length" class="notice notice-error">
          {{ error || "Periksa isian yang ditandai." }}
        </p>

        <fieldset :disabled="sibuk">
          <legend>Data akun</legend>
          <div>
            <label for="nama">Nama lengkap</label>
            <input id="nama" v-model.trim="form.namaLengkap" required minlength="2" maxlength="100" :aria-invalid="Boolean(errors.namaLengkap)" />
            <p v-if="errors.namaLengkap" class="error">{{ errors.namaLengkap }}</p>
          </div>
          <div>
            <label for="email">Email</label>
            <input id="email" v-model.trim="form.email" type="email" maxlength="254" required autocomplete="username" :aria-invalid="Boolean(errors.email)" />
            <p v-if="errors.email" class="error">{{ errors.email }}</p>
          </div>
          <div>
            <label for="sandi">Kata sandi</label>
            <div class="password-field">
              <input id="sandi" v-model="form.kataSandi" :type="lihatSandi ? 'text' : 'password'" required autocomplete="new-password" :aria-invalid="Boolean(errors.kataSandi)" />
              <button class="password-toggle button-quiet" type="button" :aria-pressed="lihatSandi" @click="lihatSandi = !lihatSandi"><Ikon nama="mata" /></button>
            </div>
            <p v-if="errors.kataSandi" class="error">{{ errors.kataSandi }}</p>
          </div>
          <div>
            <label for="konfirmasi">Ulangi kata sandi</label>
            <input id="konfirmasi" v-model="form.konfirmasiSandi" :type="lihatSandi ? 'text' : 'password'" required autocomplete="new-password" :aria-invalid="Boolean(errors.konfirmasiSandi)" />
            <p v-if="errors.konfirmasiSandi" class="error">{{ errors.konfirmasiSandi }}</p>
          </div>
        </fieldset>

        <fieldset v-if="form.peran === 'penyedia'" :disabled="sibuk">
          <legend>Profil usaha</legend>
          <div>
            <label for="usaha">Nama usaha</label>
            <input id="usaha" v-model.trim="form.namaUsaha" required :aria-invalid="Boolean(errors.namaUsaha)" />
            <p v-if="errors.namaUsaha" class="error">{{ errors.namaUsaha }}</p>
          </div>
          <div>
            <label for="alamat">Alamat pengambilan</label>
            <textarea id="alamat" v-model.trim="form.alamat" rows="3" required :aria-invalid="Boolean(errors.alamat)"></textarea>
            <p v-if="errors.alamat" class="error">{{ errors.alamat }}</p>
          </div>
          <div>
            <label for="telp">Nomor telepon usaha</label>
            <input id="telp" v-model.trim="form.nomorTelepon" required :aria-invalid="Boolean(errors.nomorTelepon)" />
            <p v-if="errors.nomorTelepon" class="error">{{ errors.nomorTelepon }}</p>
          </div>
        </fieldset>

        <button class="button-wide" type="submit">{{ sibuk ? "Memproses…" : "Daftar" }}<Ikon nama="panah" /></button>
      </form>

      <p class="field-hint">Sudah punya akun? <RouterLink to="/login">Login</RouterLink></p>
    </div>
  </section>
</template>
