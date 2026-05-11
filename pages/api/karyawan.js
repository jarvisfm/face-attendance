import { getSheets, SPREADSHEET_ID, SHEET_KARYAWAN } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const sheets = getSheets();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_KARYAWAN}!A2:F1000`,
      });

      const rows = response.data.values || [];
      const karyawan = rows
        .filter(r => r[0])
        .map(r => ({
          id: r[0] || '',
          nama: r[1] || '',
          jabatan: r[2] || '',
          departemen: r[3] || '',
          faceDescriptor: r[4] ? JSON.parse(r[4]) : null,
          tanggalDaftar: r[5] || '',
        }));

      return res.status(200).json({ success: true, data: karyawan });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (req.method === 'POST') {
    // Tambah karyawan baru
    try {
      const { nama, jabatan, departemen } = req.body;
      if (!nama || !jabatan) return res.status(400).json({ success: false, error: 'Nama & jabatan wajib diisi' });

      const sheets = getSheets();

      // Get last row to generate ID
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_KARYAWAN}!A2:A1000`,
      });
      const count = (existing.data.values || []).filter(r => r[0]).length;
      const newId = 'EMP' + String(count + 1).padStart(3, '0');
      const tanggal = new Date().toLocaleDateString('id-ID');

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_KARYAWAN}!A:F`,
        valueInputOption: 'RAW',
        requestBody: { values: [[newId, nama, jabatan, departemen || 'Umum', '', tanggal]] },
      });

      return res.status(200).json({ success: true, message: `Karyawan ${nama} berhasil ditambahkan`, id: newId });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  res.status(405).end();
}
