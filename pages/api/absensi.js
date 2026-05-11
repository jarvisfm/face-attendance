import { getSheets, SPREADSHEET_ID, SHEET_ABSENSI } from '../../lib/sheets';

function getWITA() {
  // UTC+8 = WITA (Makassar)
  const now = new Date();
  const wita = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return wita;
}

function formatDate(d) {
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

function formatTime(d) {
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tipe, id, nama, jabatan } = req.body;
  if (!tipe || !id || !nama) return res.status(400).json({ success: false, error: 'Data tidak lengkap' });

  try {
    const sheets = getSheets();
    const now = getWITA();
    const tanggal = formatDate(now);
    const jam = formatTime(now);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_ABSENSI}!A2:H2000`,
    });

    const rows = response.data.values || [];

    if (tipe === 'masuk') {
      // Cek sudah absen masuk hari ini
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === id && rows[i][3] === tanggal) {
          if (!rows[i][5]) {
            return res.status(200).json({ success: false, error: 'Sudah absen masuk hari ini. Silakan absen keluar.', tipe: 'sudah_masuk' });
          }
          return res.status(200).json({ success: false, error: 'Sudah absen lengkap hari ini.', tipe: 'sudah_lengkap' });
        }
      }

      // Tentukan status (batas jam 08:30 WITA)
      const batas = new Date(now);
      batas.setUTCHours(8, 30, 0, 0);
      const status = now > batas ? 'Terlambat' : 'Tepat Waktu';

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_ABSENSI}!A:H`,
        valueInputOption: 'RAW',
        requestBody: { values: [[id, nama, jabatan || '-', tanggal, jam, '', status, '']] },
      });

      return res.status(200).json({ success: true, message: `Selamat datang, ${nama}!`, jam, tanggal, status });
    }

    if (tipe === 'keluar') {
      let rowIndex = -1;
      let jamMasuk = '';

      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === id && rows[i][3] === tanggal && rows[i][4] && !rows[i][5]) {
          rowIndex = i + 2;
          jamMasuk = rows[i][4];
          break;
        }
      }

      if (rowIndex === -1) {
        return res.status(200).json({ success: false, error: 'Tidak ada absen masuk hari ini.' });
      }

      // Hitung durasi
      const [jh, jm, js] = jamMasuk.split(':').map(Number);
      const masukMs = (jh * 3600 + jm * 60 + js) * 1000;
      const keluarMs = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) * 1000;
      const durasi = ((keluarMs - masukMs) / 3600000).toFixed(2);

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: `${SHEET_ABSENSI}!F${rowIndex}`, values: [[jam]] },
            { range: `${SHEET_ABSENSI}!H${rowIndex}`, values: [[durasi]] },
          ],
        },
      });

      return res.status(200).json({ success: true, message: `Sampai jumpa, ${nama}!`, jam, tanggal, durasi });
    }

    return res.status(400).json({ success: false, error: 'Tipe tidak valid' });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
