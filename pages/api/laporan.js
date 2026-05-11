import { getSheets, SPREADSHEET_ID, SHEET_ABSENSI } from '../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { bulan, tahun } = req.query;

  try {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_ABSENSI}!A2:H2000`,
    });

    const rows = response.data.values || [];
    const data = rows
      .filter(r => {
        if (!r[0]) return false;
        if (!bulan || !tahun) return true;
        const parts = (r[3] || '').split('/');
        return parts.length === 3 && parseInt(parts[1]) === parseInt(bulan) && parseInt(parts[2]) === parseInt(tahun);
      })
      .map(r => ({
        id: r[0], nama: r[1], jabatan: r[2], tanggal: r[3],
        jamMasuk: r[4], jamKeluar: r[5], status: r[6], durasi: r[7],
      }));

    return res.status(200).json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
