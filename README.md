# 🎯 FaceAttend — Absensi Face ID

Aplikasi absensi berbasis pengenalan wajah menggunakan Next.js + face-api.js + Google Sheets.

---

## 📋 Cara Setup & Deploy ke Vercel

### Langkah 1: Buat Google Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com) → buat spreadsheet baru
2. Buat **2 sheet** dengan nama persis:
   - `Karyawan`
   - `Absensi`
3. Catat **ID spreadsheet** dari URL:
   `https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

---

### Langkah 2: Buat Google Service Account

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru (atau gunakan yang sudah ada)
3. Di menu **APIs & Services → Library**, aktifkan:
   - ✅ **Google Sheets API**
4. Buka **APIs & Services → Credentials**
5. Klik **+ CREATE CREDENTIALS → Service Account**
6. Isi nama service account → klik **Done**
7. Klik service account yang baru dibuat → tab **Keys**
8. Klik **ADD KEY → Create new key → JSON** → Download file JSON
9. Dari file JSON tersebut, ambil:
   - `client_email` → ini adalah `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → ini adalah `GOOGLE_PRIVATE_KEY`

---

### Langkah 3: Beri Akses ke Spreadsheet

1. Buka spreadsheet yang sudah dibuat
2. Klik tombol **Share** (bagikan)
3. Tambahkan email service account (`client_email` dari JSON)
4. Beri role **Editor**
5. Klik **Done**

---

### Langkah 4: Upload ke GitHub

1. Buat repo baru di GitHub (misalnya: `face-attendance`)
2. Upload semua file dari folder ini ke repo tersebut
3. Pastikan file `.env.local.example` **tidak** berisi data asli

---

### Langkah 5: Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → Login dengan GitHub
2. Klik **New Project** → pilih repo `face-attendance`
3. Sebelum deploy, tambahkan **Environment Variables**:

   | Nama Variable | Nilai |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email dari file JSON (client_email) |
   | `GOOGLE_PRIVATE_KEY` | Private key dari JSON (termasuk `-----BEGIN...`) |
   | `GOOGLE_SPREADSHEET_ID` | ID spreadsheet dari URL |

   ⚠️ **Penting untuk GOOGLE_PRIVATE_KEY:**
   - Copy seluruh nilai `private_key` dari file JSON
   - Termasuk `-----BEGIN RSA PRIVATE KEY-----` dan `-----END RSA PRIVATE KEY-----`
   - Biarkan Vercel menyimpannya apa adanya (jangan edit manual)

4. Klik **Deploy** → tunggu proses selesai
5. Buka URL yang diberikan Vercel

---

## ✨ Fitur Aplikasi

| Fitur | Keterangan |
|---|---|
| 📷 Deteksi wajah real-time | face-api.js TinyFaceDetector |
| 👤 Registrasi wajah karyawan | Simpan face descriptor ke Google Sheets |
| ✅ Absen masuk & keluar | Otomatis catat waktu (zona WITA) |
| ⏰ Status tepat/terlambat | Batas jam 08:30 (dapat diubah di `pages/api/absensi.js`) |
| 📊 Laporan bulanan | Filter per bulan & tahun |
| 👥 Manajemen karyawan | Tambah karyawan dari UI |

---

## ⚙️ Mengubah Batas Jam Masuk

Edit file `pages/api/absensi.js`, cari baris:
```js
batas.setUTCHours(8, 30, 0, 0); // 08:30 WITA
```
Ubah angka `8` (jam) dan `30` (menit) sesuai kebutuhan.

---

## 🗂️ Struktur File

```
face-attendance/
├── pages/
│   ├── index.js          ← Halaman utama (UI)
│   ├── _app.js
│   └── api/
│       ├── karyawan.js   ← GET/POST data karyawan
│       ├── absensi.js    ← POST absen masuk/keluar
│       ├── face-register.js ← POST simpan face descriptor
│       └── laporan.js    ← GET laporan absensi
├── lib/
│   └── sheets.js         ← Helper Google Sheets API
├── package.json
├── next.config.js
└── .env.local.example    ← Template environment variables
```

---

## 🔧 Development Lokal

1. Copy `.env.local.example` → `.env.local` dan isi nilainya
2. Jalankan:
```bash
npm install
npm run dev
```
3. Buka `http://localhost:3000`

---

## ❓ Troubleshooting

**Kamera tidak muncul?**
- Pastikan browser menggunakan HTTPS (Vercel otomatis HTTPS)
- Izinkan akses kamera di browser

**Error Google Sheets?**
- Pastikan service account sudah diberi akses Editor ke spreadsheet
- Pastikan Google Sheets API sudah diaktifkan di Google Cloud
- Cek GOOGLE_PRIVATE_KEY sudah benar (termasuk newline)

**Wajah tidak terdeteksi?**
- Pastikan pencahayaan cukup
- Jarak wajah 40-70cm dari kamera
- Karyawan harus didaftarkan wajahnya lebih dulu di menu Karyawan
