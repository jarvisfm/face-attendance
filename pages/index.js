import { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';

const api = (url, opts) => fetch(url, opts).then(r => r.json());
const TABS = ['absensi', 'karyawan', 'laporan'];
const TAB_LABELS = { absensi: '📷 Absensi', karyawan: '👥 Karyawan', laporan: '📊 Laporan' };
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const FACEAPI_CDN = 'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js';
const MODEL_URL = 'https://unpkg.com/face-api.js@0.22.2/weights';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function Home() {
  const [tab, setTab] = useState('absensi');
  const [clock, setClock] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [toast, setToast] = useState({ show: false, msg: '' });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanRef = useRef(null);
  const [camStatus, setCamStatus] = useState('Memuat model AI…');
  const [camDotColor, setCamDotColor] = useState('#ffa502');
  const [modelsReady, setModelsReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [loadMsg, setLoadMsg] = useState('Memuat model AI wajah…');
  const [karyawanList, setKaryawanList] = useState([]);
  const [detectedPerson, setDetectedPerson] = useState(null);
  const [btnDisabled, setBtnDisabled] = useState(true);
  const [statusBox, setStatusBox] = useState(null);
  const [empLoading, setEmpLoading] = useState(false);
  const [modalAdd, setModalAdd] = useState(false);
  const [addForm, setAddForm] = useState({ nama: '', jabatan: '', departemen: 'IT' });
  const [modalReg, setModalReg] = useState(false);
  const [regTarget, setRegTarget] = useState(null);
  const videoRegRef = useRef(null);
  const streamRegRef = useRef(null);
  const [regStatus, setRegStatus] = useState('');
  const now = new Date();
  const [filterBulan, setFilterBulan] = useState(now.getMonth() + 1);
  const [filterTahun, setFilterTahun] = useState(now.getFullYear());
  const [laporanData, setLaporanData] = useState([]);
  const [laporanLoading, setLaporanLoading] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toLocaleTimeString('id-ID'));
      setDateStr(d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg }), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await loadScript(FACEAPI_CDN);
      if (cancelled) return;
      const faceapi = window.faceapi;
      const steps = [
        { fn: () => faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), label: 'Detektor wajah…', pct: 33 },
        { fn: () => faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), label: 'Landmark wajah…', pct: 66 },
        { fn: () => faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), label: 'Rekognisi wajah…', pct: 100 },
      ];
      for (const s of steps) {
        if (cancelled) return;
        setLoadMsg(s.label);
        await s.fn();
        setLoadPct(s.pct);
      }
      if (cancelled) return;
      setModelsReady(true);
      setCamStatus('Model siap');
      setCamDotColor('#2ed573');
      await startCamera();
      loadKaryawanData();
    }
    load().catch(e => { setCamStatus('Gagal memuat model'); console.error(e); });
    return () => { cancelled = true; };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(res => { videoRef.current.onloadedmetadata = res; });
        setCamDotColor('#2ed573');
        setCamStatus('Kamera aktif');
      }
    } catch (e) {
      setCamStatus('Kamera gagal!');
      setCamDotColor('#ff4757');
      showToast('Izin kamera diperlukan!');
    }
  };

  const loadKaryawanData = useCallback(async () => {
    const res = await api('/api/karyawan');
    if (res.success) setKaryawanList(res.data);
  }, []);

  useEffect(() => {
    if (!modelsReady) return;
    const faceapi = window.faceapi;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const scanLine = scanRef.current;
    const interval = setInterval(async () => {
      if (!video || video.readyState !== 4) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const dets = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks().withFaceDescriptors();
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (dets.length > 0) {
        scanLine && scanLine.classList.add('active');
        for (const det of dets) {
          const b = det.detection.box;
          ctx.strokeStyle = 'rgba(0,212,170,0.9)'; ctx.lineWidth = 2;
          ctx.strokeRect(b.x, b.y, b.width, b.height);
        }
        const withDesc = karyawanList.filter(k => k.faceDescriptor);
        if (withDesc.length > 0) {
          const labeled = withDesc.map(k => new faceapi.LabeledFaceDescriptors(k.id, [new Float32Array(k.faceDescriptor)]));
          const matcher = new faceapi.FaceMatcher(labeled, 0.55);
          const best = matcher.findBestMatch(dets[0].descriptor);
          if (best.label !== 'unknown') {
            const found = karyawanList.find(k => k.id === best.label);
            if (found) { setDetectedPerson(found); setBtnDisabled(false); return; }
          }
        }
        setDetectedPerson(null); setBtnDisabled(false);
      } else {
        scanLine && scanLine.classList.remove('active');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setDetectedPerson(null); setBtnDisabled(true);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [modelsReady, karyawanList]);

  const prosesAbsen = async (tipe) => {
    if (!detectedPerson) { setStatusBox({ type: 'warning', icon: '⚠️', title: 'Wajah belum dikenali', sub: 'Pastikan wajah terdaftar di sistem' }); return; }
    setBtnDisabled(true);
    const res = await api('/api/absensi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipe, id: detectedPerson.id, nama: detectedPerson.nama, jabatan: detectedPerson.jabatan }) });
    if (res.success) {
      const sub = tipe === 'masuk' ? 'Jam: ' + res.jam + ' | Status: ' + res.status : 'Jam: ' + res.jam + ' | Durasi: ' + res.durasi + ' jam';
      setStatusBox({ type: 'success', icon: tipe === 'masuk' ? '✅' : '👋', title: res.message, sub });
      showToast(res.message);
    } else { setStatusBox({ type: 'error', icon: '❌', title: 'Gagal Absen', sub: res.error }); }
    setBtnDisabled(false);
  };

  const loadKaryawanPage = async () => { setEmpLoading(true); await loadKaryawanData(); setEmpLoading(false); };
  useEffect(() => { if (tab === 'karyawan') loadKaryawanPage(); }, [tab]);

  const simpanKaryawan = async () => {
    if (!addForm.nama || !addForm.jabatan) { showToast('Nama & jabatan wajib diisi!'); return; }
    const res = await api('/api/karyawan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) });
    setModalAdd(false);
    if (res.success) { showToast('✅ ' + res.message); loadKaryawanData(); } else showToast('❌ ' + res.error);
  };

  const bukaRegFace = async (k) => {
    setRegTarget(k); setRegStatus('Posisikan wajah dan klik tombol ambil gambar'); setModalReg(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    streamRegRef.current = stream;
    setTimeout(() => { if (videoRegRef.current) videoRegRef.current.srcObject = stream; }, 100);
  };

  const tutupRegFace = () => {
    setModalReg(false);
    if (streamRegRef.current) { streamRegRef.current.getTracks().forEach(t => t.stop()); streamRegRef.current = null; }
  };

  const ambilFotoReg = async () => {
    const faceapi = window.faceapi;
    setRegStatus('⏳ Memproses wajah…');
    const det = await faceapi.detectSingleFace(videoRegRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
    if (!det) { setRegStatus('❌ Wajah tidak terdeteksi, coba lagi.'); return; }
    const descriptor = Array.from(det.descriptor);
    const res = await api('/api/face-register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: regTarget.id, descriptor }) });
    if (res.success) { showToast('✅ ' + res.message); tutupRegFace(); loadKaryawanData(); } else setRegStatus('❌ ' + res.error);
  };

  const loadLaporan = async () => {
    setLaporanLoading(true);
    const res = await api('/api/laporan?bulan=' + filterBulan + '&tahun=' + filterTahun);
    if (res.success) setLaporanData(res.data);
    setLaporanLoading(false);
  };
  useEffect(() => { if (tab === 'laporan') loadLaporan(); }, [tab]);

  const statTepat = laporanData.filter(d => d.status === 'Tepat Waktu').length;
  const statLambat = laporanData.filter(d => d.status === 'Terlambat').length;
  const durasiList = laporanData.filter(d => d.durasi).map(d => parseFloat(d.durasi));
  const rataJam = durasiList.length ? (durasiList.reduce((a, b) => a + b, 0) / durasiList.length).toFixed(1) : '-';

  return (
    <>
      <Head>
        <title>FaceAttend</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ fontFamily: "'Segoe UI',sans-serif", background: '#0d0d1a', color: '#e8e8f0', minHeight: '100vh' }}>
        <header style={{ background: '#161630', borderBottom: '1px solid #2a2a4a', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#6c63ff,#00d4aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👁️</div>
            <div><div style={{ fontWeight: 700, fontSize: 17 }}>FaceAttend</div><div style={{ fontSize: 11, color: '#8888aa' }}>Sistem Absensi Wajah</div></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#00d4aa' }}>{clock}</div>
            <div style={{ fontSize: 11, color: '#8888aa' }}>{dateStr}</div>
          </div>
        </header>

        <div style={{ background: '#161630', borderBottom: '1px solid #2a2a4a', display: 'flex', padding: '0 24px', gap: 4 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '13px 18px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #6c63ff' : '2px solid transparent', color: tab === t ? '#6c63ff' : '#8888aa', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{TAB_LABELS[t]}</button>
          ))}
        </div>

        {tab === 'absensi' && (
          <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8888aa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Kamera Absensi</div>
                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '4/3', maxHeight: 400, border: '2px solid #2a2a4a' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
                  <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
                  <div ref={scanRef} className="scan-line" />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 180, height: 210, borderRadius: '50% 50% 45% 45%', border: '2px dashed #6c63ff', opacity: 0.5, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', border: '1px solid #2a2a4a', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#00d4aa', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: camDotColor }} />{camStatus}
                  </div>
                </div>
                {!modelsReady && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ background: 'rgba(108,99,255,0.1)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg,#6c63ff,#00d4aa)', borderRadius: 4, width: loadPct + '%', transition: 'width .5s ease' }} />
                    </div>
                    <p style={{ fontSize: 12, color: '#8888aa', textAlign: 'center', marginTop: 6 }}>{loadMsg}</p>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                  <Btn color="#2ed573" textColor="#0d2a1a" disabled={btnDisabled} onClick={() => prosesAbsen('masuk')}>✅ Absen Masuk</Btn>
                  <Btn color="#ff4757" textColor="#fff" disabled={btnDisabled} onClick={() => prosesAbsen('keluar')}>🚪 Absen Keluar</Btn>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8888aa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Identifikasi Wajah</div>
                {detectedPerson ? (
                  <div style={{ background: '#161630', border: '1px solid #6c63ff', borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#00d4aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }}>{detectedPerson.nama.charAt(0)}</div>
                      <div><div style={{ fontWeight: 700, fontSize: 17 }}>{detectedPerson.nama}</div><div style={{ fontSize: 13, color: '#8888aa' }}>{detectedPerson.jabatan}</div></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[detectedPerson.departemen, detectedPerson.id].map(v => (<span key={v} style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 8, padding: '3px 12px', fontSize: 12, color: '#6c63ff' }}>{v}</span>))}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#161630', border: '1px solid #2a2a4a', borderRadius: 14, padding: 16, fontSize: 13, color: '#8888aa', lineHeight: 2 }}>
                    📌 Posisikan wajah di depan kamera<br />📌 Pastikan pencahayaan cukup<br />📌 Deteksi otomatis tiap 1.5 detik<br />📌 Klik tombol setelah wajah terdeteksi
                  </div>
                )}
                {statusBox && (
                  <div style={{ background: '#161630', border: '1px solid ' + (statusBox.type === 'success' ? '#2ed573' : statusBox.type === 'error' ? '#ff4757' : '#ffa502'), borderRadius: 14, padding: 14, marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{statusBox.icon}</span>
                    <div><div style={{ fontWeight: 600 }}>{statusBox.title}</div><div style={{ fontSize: 13, color: '#8888aa', marginTop: 4 }}>{statusBox.sub}</div></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'karyawan' && (
          <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Data Karyawan</h2>
              <Btn color="#6c63ff" textColor="#fff" onClick={() => setModalAdd(true)}>➕ Tambah Karyawan</Btn>
            </div>
            {empLoading ? <p style={{ textAlign: 'center', color: '#8888aa', padding: 40 }}>⏳ Memuat data…</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {karyawanList.map(k => (
                  <div key={k.id} style={{ background: '#161630', border: '1px solid #2a2a4a', borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#00d4aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{k.nama.charAt(0)}</div>
                      <div><b>{k.nama}</b><div style={{ fontSize: 12, color: '#8888aa' }}>{k.jabatan} · {k.departemen}</div><div style={{ fontSize: 11, color: '#6c63ff' }}>{k.id}</div></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: k.faceDescriptor ? '#2ed573' : '#8888aa' }} />
                      <span style={{ color: '#8888aa' }}>{k.faceDescriptor ? 'Wajah terdaftar' : 'Wajah belum terdaftar'}</span>
                    </div>
                    <button onClick={() => bukaRegFace(k)} style={{ width: '100%', padding: '9px 0', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 10, color: '#e8e8f0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      📸 {k.faceDescriptor ? 'Perbarui Wajah' : 'Daftarkan Wajah'}
                    </button>
                  </div>
                ))}
                {karyawanList.length === 0 && <p style={{ color: '#8888aa' }}>Belum ada karyawan.</p>}
              </div>
            )}
          </div>
        )}

        {tab === 'laporan' && (
          <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
              {[['Total Hadir', laporanData.length, '#00d4aa'], ['Tepat Waktu', statTepat, '#2ed573'], ['Terlambat', statLambat, '#ffa502'], ['Rata-rata Jam', rataJam + 'h', '#6c63ff']].map(([label, val, color]) => (
                <div key={label} style={{ background: '#161630', border: '1px solid #2a2a4a', borderRadius: 14, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: 12, color: '#8888aa', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)} style={selStyle}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={filterTahun} onChange={e => setFilterTahun(e.target.value)} style={selStyle}>
                {[0, 1, 2, 3].map(i => <option key={i} value={now.getFullYear() - i}>{now.getFullYear() - i}</option>)}
              </select>
              <button onClick={loadLaporan} style={{ padding: '9px 20px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 10, color: '#e8e8f0', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>🔍 Tampilkan</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['ID', 'Nama', 'Jabatan', 'Tanggal', 'Jam Masuk', 'Jam Keluar', 'Status', 'Durasi'].map(h => (
                  <th key={h} style={{ background: 'rgba(108,99,255,.15)', color: '#6c63ff', padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #2a2a4a' }}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {laporanLoading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: '#8888aa' }}>⏳ Memuat…</td></tr>
                    : laporanData.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: '#8888aa' }}>Tidak ada data</td></tr>
                    : laporanData.map((d, i) => (
                      <tr key={i}>
                        <td style={tdS}>{d.id}</td><td style={tdS}><b>{d.nama}</b></td>
                        <td style={{ ...tdS, color: '#8888aa' }}>{d.jabatan}</td><td style={tdS}>{d.tanggal}</td>
                        <td style={{ ...tdS, color: '#00d4aa' }}>{d.jamMasuk || '-'}</td>
                        <td style={{ ...tdS, color: '#8888aa' }}>{d.jamKeluar || '-'}</td>
                        <td style={tdS}><span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: d.status === 'Tepat Waktu' ? 'rgba(46,213,115,.15)' : d.status === 'Terlambat' ? 'rgba(255,165,2,.15)' : 'rgba(136,136,170,.15)', color: d.status === 'Tepat Waktu' ? '#2ed573' : d.status === 'Terlambat' ? '#ffa502' : '#8888aa' }}>{d.status || '-'}</span></td>
                        <td style={tdS}>{d.durasi ? d.durasi + ' jam' : '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {modalAdd && (
          <ModalOverlay onClose={() => setModalAdd(false)}>
            <div style={modalSt}>
              <h3 style={{ fontSize: 18, marginBottom: 18 }}>➕ Tambah Karyawan</h3>
              {[['Nama Lengkap', 'nama', 'Nama karyawan'], ['Jabatan', 'jabatan', 'Jabatan']].map(([lbl, key, ph]) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: '#8888aa', display: 'block', marginBottom: 6 }}>{lbl}</label>
                  <input placeholder={ph} value={addForm[key]} onChange={e => setAddForm(p => ({ ...p, [key]: e.target.value }))} style={inpSt} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#8888aa', display: 'block', marginBottom: 6 }}>Departemen</label>
                <select value={addForm.departemen} onChange={e => setAddForm(p => ({ ...p, departemen: e.target.value }))} style={inpSt}>
                  {['IT', 'Keuangan', 'HR', 'Operasional', 'Marketing', 'Umum'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn color="#6c63ff" textColor="#fff" onClick={simpanKaryawan} style={{ flex: 1 }}>Simpan</Btn>
                <button onClick={() => setModalAdd(false)} style={{ flex: 1, ...outBt }}>Batal</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {modalReg && (
          <ModalOverlay onClose={tutupRegFace}>
            <div style={modalSt}>
              <h3 style={{ fontSize: 18, marginBottom: 6 }}>📸 Daftarkan Wajah</h3>
              <p style={{ fontSize: 13, color: '#8888aa', marginBottom: 14 }}>Karyawan: <b style={{ color: '#e8e8f0' }}>{regTarget?.nama}</b></p>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '4/3', maxHeight: 240, border: '1px solid #2a2a4a' }}>
                <video ref={videoRegRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              </div>
              <p style={{ fontSize: 13, color: '#8888aa', textAlign: 'center', margin: '12px 0' }}>{regStatus}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn color="#6c63ff" textColor="#fff" onClick={ambilFotoReg} style={{ flex: 1 }}>📸 Ambil & Daftar</Btn>
                <button onClick={tutupRegFace} style={{ flex: 1, ...outBt }}>Batal</button>
              </div>
            </div>
          </ModalOverlay>
        )}

        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%) translateY(' + (toast.show ? '0' : '100px') + ')', background: '#161630', border: '1px solid #6c63ff', borderRadius: 12, padding: '12px 20px', fontSize: 14, zIndex: 999, transition: 'transform .3s ease', maxWidth: 340, textAlign: 'center' }}>{toast.msg}</div>
      </div>

      <style>{`.scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#00d4aa,transparent);animation:scan 2s linear infinite;opacity:0;transition:opacity .3s}.scan-line.active{opacity:1}@keyframes scan{from{top:0}to{top:100%}}*{box-sizing:border-box;margin:0;padding:0}body{background:#0d0d1a}`}</style>
    </>
  );
}

const tdS = { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' };
const selStyle = { background: '#161630', border: '1px solid #2a2a4a', borderRadius: 10, padding: '9px 14px', color: '#e8e8f0', fontSize: 14, fontFamily: 'inherit' };
const modalSt = { background: '#161630', border: '1px solid #2a2a4a', borderRadius: 20, padding: 28, width: '90%', maxWidth: 400 };
const inpSt = { width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid #2a2a4a', borderRadius: 10, padding: '10px 14px', color: '#e8e8f0', fontSize: 14, fontFamily: 'inherit' };
const outBt = { background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 12, color: '#e8e8f0', fontSize: 14, cursor: 'pointer', padding: '12px 16px', fontFamily: 'inherit' };

function Btn({ color, textColor, disabled, onClick, children, style }) {
  return <button disabled={disabled} onClick={onClick} style={{ padding: '13px 16px', border: 'none', borderRadius: 12, background: disabled ? '#333' : color, color: disabled ? '#666' : textColor, fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .2s', ...style }}>{children}</button>;
}

function ModalOverlay({ children, onClose }) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div onClick={e => e.stopPropagation()}>{children}</div></div>;
}
