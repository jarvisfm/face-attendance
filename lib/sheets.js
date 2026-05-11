import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export function getAuth() {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    privateKey,
    SCOPES
  );
}

export function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
export const SHEET_ABSENSI = 'Absensi';
export const SHEET_KARYAWAN = 'Karyawan';

// Inisialisasi sheet header jika belum ada
export async function initSheets() {
  const sheets = getSheets();

  // Cek sheet Karyawan
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_KARYAWAN}!A1:F1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_KARYAWAN}!A1:F1`,
        valueInputOption: 'RAW',
        requestBody: { values: [['ID', 'Nama', 'Jabatan', 'Departemen', 'FaceDescriptor', 'TanggalDaftar']] },
      });
    }
  } catch (e) {
    // Sheet mungkin belum ada, buat via API batch
  }

  // Cek sheet Absensi
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_ABSENSI}!A1:H1`,
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_ABSENSI}!A1:H1`,
        valueInputOption: 'RAW',
        requestBody: { values: [['ID', 'Nama', 'Jabatan', 'Tanggal', 'JamMasuk', 'JamKeluar', 'Status', 'Durasi']] },
      });
    }
  } catch (e) {}
}
