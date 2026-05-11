import { getSheets, SPREADSHEET_ID, SHEET_KARYAWAN } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id, descriptor } = req.body;
  if (!id || !descriptor) return res.status(400).json({ success: false, error: 'ID dan descriptor wajib' });

  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_KARYAWAN}!A2:F1000`,
    });

    const rows = response.data.values || [];
    let rowIndex = -1;
    let namaKaryawan = '';

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id) {
        rowIndex = i + 2; // +2 karena header di row 1
        namaKaryawan = rows[i][1];
        break;
      }
    }

    if (rowIndex === -1) return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan' });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_KARYAWAN}!E${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[JSON.stringify(descriptor)]] },
    });

    return res.status(200).json({ success: true, message: `Wajah ${namaKaryawan} berhasil didaftarkan` });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
