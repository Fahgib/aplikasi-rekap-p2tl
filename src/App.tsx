import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileText,
  Download,
  Trash2,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  Wallet,
  CreditCard,
  Files,
  Search,
  Eye,
  X,
  Building2,
  Calendar,
  Copy,
  Check,
  Edit3,
  BarChart3,
  Table2,
} from 'lucide-react';
import type { P2TLRecord } from './types/p2tl';
import { processP2TLFiles } from './utils/p2tlParser';

const STORAGE_KEY = 'p2tl_rekap_records_v1';

export default function App() {
  const [recordMap, setRecordMap] = useState<Map<string, P2TLRecord>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: [string, P2TLRecord][] = JSON.parse(saved);
        return new Map(parsed);
      }
    } catch (e) {
      console.error('Gagal memuat penyimpanan lokal:', e);
    }
    return new Map();
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'rekap' | 'angsuran' | 'statistik'>('rekap');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGolongan, setFilterGolongan] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LENGKAP' | 'KURANG' | 'SPH' | 'NON_SPH'>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<P2TLRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<P2TLRecord | null>(null);
  const [copiedAgenda, setCopiedAgenda] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Simpan otomatis ke localStorage agar tidak hilang saat ter-refresh
  useEffect(() => {
    try {
      const entries = Array.from(recordMap.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('Gagal menyimpan ke localStorage:', e);
    }
  }, [recordMap]);

  const allRecords = Array.from(recordMap.values());

  // Filter pencarian, golongan, dan status
  const records = allRecords.filter((rec) => {
    const matchGol = filterGolongan === 'ALL' || rec.golongan === filterGolongan;

    let matchStatus = true;
    if (filterStatus === 'LENGKAP') matchStatus = rec.statusKelengkapan.startsWith('LENGKAP');
    if (filterStatus === 'KURANG') matchStatus = rec.statusKelengkapan.startsWith('KURANG');
    if (filterStatus === 'SPH') matchStatus = rec.skemaPembayaran.includes('Angsuran');
    if (filterStatus === 'NON_SPH') matchStatus = !rec.skemaPembayaran.includes('Angsuran');

    const q = searchQuery.toLowerCase();
    const matchQuery =
      !q ||
      rec.noAgenda.toLowerCase().includes(q) ||
      rec.namaPelanggan.toLowerCase().includes(q) ||
      rec.namaKTP.toLowerCase().includes(q) ||
      rec.idPelangganTemuan.toLowerCase().includes(q) ||
      rec.idPelPenanggung.toLowerCase().includes(q) ||
      rec.noBA.toLowerCase().includes(q) ||
      rec.alamatTemuan.toLowerCase().includes(q);

    return matchGol && matchStatus && matchQuery;
  });

  // Ringkasan Kartu Statistik Argon
  const totalPelanggan = allRecords.length;
  const totalTagihan = allRecords.reduce((acc, r) => acc + r.totalTagihan, 0);
  const totalSisaPiutang = allRecords.reduce((acc, r) => acc + r.sisaHutang, 0);
  const totalBerkasPDF = allRecords.reduce((acc, r) => acc + r.namaFileMasuk.length, 0);
  const jumlahKurangBerkas = allRecords.filter((r) => r.statusKelengkapan.startsWith('KURANG')).length;

  const formatRp = (num: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const pdfFiles = Array.from(fileList).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      alert('Harap masukkan file berformat PDF (.pdf)');
      return;
    }

    setIsProcessing(true);
    try {
      const updatedMap = await processP2TLFiles(pdfFiles, recordMap);
      setRecordMap(new Map(updatedMap));
    } catch (error) {
      console.error('Gagal membaca PDF:', error);
      alert('Terjadi kesalahan saat membaca file PDF.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Salin format ringkasan ke WhatsApp / Clipboard
  const handleCopyWA = (rec: P2TLRecord) => {
    const text = [
      `*LAPORAN REKAP P2TL PLN (${rec.up3} / ${rec.ulp})*`,
      `• *No Agenda:* ${rec.noAgenda}`,
      `• *No BA & Tgl:* ${rec.noBA} (${rec.tglBA})`,
      `• *Pelanggan:* ${rec.namaPelanggan} (IDPEL: ${rec.idPelangganTemuan} | ${rec.tarifDaya})`,
      `• *Alamat:* ${rec.alamatTemuan}`,
      `• *Penandatangan KTP:* ${rec.namaKTP} (${rec.noKTP})`,
      `• *Golongan:* ${rec.jenisGolongan} (${rec.pemakaianKwh.toLocaleString('id-ID')} kWh)`,
      `• *Total Tagihan Susulan:* ${formatRp(rec.totalTagihan)}`,
      `• *Skema Bayar:* ${rec.skemaPembayaran}`,
      rec.skemaPembayaran.includes('Angsuran')
        ? `• *Rincian SPH:* DP ${formatRp(rec.uangMuka)} | Sisa ${formatRp(rec.sisaHutang)} | Cicilan ${formatRp(rec.nominalCicilan)}/bln (${rec.periodeAngsuran})\n• *IDPEL Penanggung:* ${rec.idPelPenanggung} (${rec.alamatPenanggung})`
        : null,
      `• *Status Berkas:* ${rec.statusKelengkapan}`,
      `• *Diagnosa:* ${rec.diagnosaMasalah}`,
      `• *Tindak Lanjut:* ${rec.rekomendasiSolusi}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopiedAgenda(rec.noAgenda);
    setTimeout(() => setCopiedAgenda(null), 2000);
  };

  // Hapus 1 baris pelanggan
  const handleDeleteRow = (noAgenda: string) => {
    if (window.confirm(`Hapus data pelanggan dengan No Agenda ${noAgenda}?`)) {
      const next = new Map(recordMap);
      next.delete(noAgenda);
      setRecordMap(next);
    }
  };

  // Simpan hasil edit manual
  const handleSaveEdit = () => {
    if (!editingRecord) return;
    const next = new Map(recordMap);
    next.set(editingRecord.noAgenda, editingRecord);
    setRecordMap(next);
    setEditingRecord(null);
  };

  // Export ke Excel (.xlsx) dengan 3 Sheet Kompleks & Lengkap
  const handleExportExcel = () => {
    if (allRecords.length === 0) return;

    // SHEET 1: REKAP UTAMA P2TL
    const sheet1Data = allRecords.map((rec, index) => ({
      'No Urut': index + 1,
      'Unit PLN (UP3 / ULP)': `${rec.up3} / ${rec.ulp}`,
      'No Agenda': rec.noAgenda,
      'No Berita Acara': rec.noBA,
      'Tgl Berita Acara': rec.tglBA,
      'No Penetapan TS': rec.noPenetapan,
      'Tgl Penetapan TS': rec.tglPenetapan,
      'No Register': rec.noRegister,
      'ID Pelanggan Temuan': rec.idPelangganTemuan,
      'Nama Pelanggan Temuan': rec.namaPelanggan,
      'Alamat Temuan': rec.alamatTemuan,
      'Tarif / Daya Temuan': rec.tarifDaya,
      'Nama Penandatangan (Sesuai KTP)': rec.namaKTP,
      'No KTP Penandatangan': rec.noKTP,
      'Alamat Sesuai KTP': rec.alamatKTP,
      'Jenis & Golongan Penetapan': rec.jenisGolongan,
      'Rumus Perhitungan TS':
        rec.rumusKwh !== '-' ? `Beban: ${rec.rumusBeban} | kWh: ${rec.rumusKwh}` : rec.rumusBeban,
      'Pemakaian (kWh)': rec.pemakaianKwh,
      'Biaya Beban / Rekening Minimum (Rp)': rec.biayaBeban,
      'Biaya Pemakaian kWh (Rp)': rec.biayaPemakaianKwh,
      'Subtotal Beban + kWh (Rp)': rec.subtotalBebanKwh,
      'Biaya Material (Rp)': rec.biayaMaterial,
      'Biaya Segel (Rp)': rec.biayaSegel,
      'Biaya PBJT-TL / PPJ (Rp)': rec.biayaPPJ,
      'Total Tagihan Susulan (Rp)': rec.totalTagihan,
      'Terbilang Tagihan Susulan': rec.terbilang,
      'Skema Pembayaran': rec.skemaPembayaran,
      'IDPEL Penanggung Hutang': rec.idPelPenanggung,
      'Nama & Tarif IDPEL Penanggung':
        rec.idPelPenanggung !== '-' ? `${rec.namaPenanggung} (${rec.tarifDayaPenanggung})` : '-',
      'Alamat IDPEL Penanggung': rec.alamatPenanggung,
      'Uang Muka / DP Angsuran (Rp)': rec.uangMuka,
      'Sisa Hutang Cicilan (Rp)': rec.sisaHutang,
      'Tenor Angsuran (Bulan)': rec.tenorBulan,
      'Nominal Cicilan per Bulan (Rp)': rec.nominalCicilan,
      'Periode Bulan Angsuran': rec.periodeAngsuran,
      'Pejabat Manager & Petugas Cetak': `Mgr: ${rec.manager} | Cetak: ${rec.petugasCetak}`,
      'Status Kelengkapan Berkas PDF': rec.statusKelengkapan,
      'Daftar File PDF Masuk': rec.namaFileMasuk.join(', '),
      'Diagnosa Masalah Utama': rec.diagnosaMasalah,
      'Rekomendasi Solusi & Tindak Lanjut': rec.rekomendasiSolusi,
    }));

    const wsRekap = XLSX.utils.json_to_sheet(sheet1Data);
    wsRekap['!cols'] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 28 },
      { wch: 18 },
      { wch: 15 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
      { wch: 42 },
      { wch: 15 },
      { wch: 26 },
      { wch: 20 },
      { wch: 42 },
      { wch: 20 },
      { wch: 45 },
      { wch: 15 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 45 },
      { wch: 22 },
      { wch: 20 },
      { wch: 28 },
      { wch: 38 },
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 22 },
      { wch: 34 },
      { wch: 45 },
      { wch: 38 },
      { wch: 38 },
      { wch: 65 },
      { wch: 70 },
    ];

    // SHEET 2: JADWAL MONITORING ANGSURAN BULANAN (KHUSUS SPH)
    const sheet2Data: Record<string, string | number>[] = [];
    allRecords.forEach((rec) => {
      rec.rincianAngsuran.forEach((item) => {
        sheet2Data.push({
          'No Agenda': rec.noAgenda,
          'Nama Pelanggan': rec.namaPelanggan,
          'Golongan': rec.golongan,
          'IDPEL Penanggung Tagihan': rec.idPelPenanggung,
          'Alamat Penanggung': rec.alamatPenanggung,
          'No Register SPH': rec.noRegister,
          'Angsuran Ke': `Angsuran ke-${item.ke}`,
          'Bulan Rekening': item.bulan,
          'Tanggal Jatuh Tempo': item.jatuhTempo,
          'Nominal Tagihan Bulanan (Rp)': item.nominal,
          'Total TS Awal (Rp)': rec.totalTagihan,
          'Uang Muka / DP (Rp)': rec.uangMuka,
          'Total Sisa Piutang (Rp)': rec.sisaHutang,
        });
      });
    });

    const wsAngsuran = XLSX.utils.json_to_sheet(
      sheet2Data.length > 0
        ? sheet2Data
        : [{ Info: 'Tidak ada pelanggan dengan skema angsuran (SPH) pada sesi ini.' }]
    );
    wsAngsuran['!cols'] = [
      { wch: 28 },
      { wch: 24 },
      { wch: 12 },
      { wch: 22 },
      { wch: 38 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 },
      { wch: 24 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
    ];

    // SHEET 3: RINGKASAN STATISTIK PER GOLONGAN
    const golonganList = ['P1', 'P2', 'P3', 'P4'];
    const sheet3Data = golonganList.map((gol) => {
      const subset = allRecords.filter((r) => r.golongan === gol);
      return {
        'Golongan Penetapan': `Golongan ${gol}`,
        'Jumlah Pelanggan': subset.length,
        'Total Pemakaian (kWh)': subset.reduce((s, r) => s + r.pemakaianKwh, 0),
        'Total Biaya Beban (Rp)': subset.reduce((s, r) => s + r.biayaBeban, 0),
        'Total Biaya kWh (Rp)': subset.reduce((s, r) => s + r.biayaPemakaianKwh, 0),
        'Total Tagihan Susulan (Rp)': subset.reduce((s, r) => s + r.totalTagihan, 0),
        'Total Uang Muka / DP Masuk (Rp)': subset.reduce((s, r) => s + r.uangMuka, 0),
        'Total Sisa Piutang Angsuran (Rp)': subset.reduce((s, r) => s + r.sisaHutang, 0),
      };
    });
    const wsStatistik = XLSX.utils.json_to_sheet(sheet3Data);
    wsStatistik['!cols'] = [
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 26 },
      { wch: 26 },
      { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, wsRekap, 'Rekap Utama P2TL');
    XLSX.utils.book_append_sheet(workbook, wsAngsuran, 'Jadwal Angsuran SPH');
    XLSX.utils.book_append_sheet(workbook, wsStatistik, 'Ringkasan Statistik');

    const tanggalHariIni = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Rekap_Lengkap_P2TL_${tanggalHariIni}.xlsx`);
  };

  const handleReset = () => {
    if (window.confirm('Bersihkan semua data rekap di layar untuk memulai sesi baru?')) {
      setRecordMap(new Map());
      localStorage.removeItem(STORAGE_KEY);
      setSelectedRecord(null);
      setEditingRecord(null);
    }
  };

  // Kumpulkan semua jadwal angsuran untuk Tab 2
  const allAngsuranRows = allRecords.flatMap((rec) =>
    rec.rincianAngsuran.map((ang) => ({
      noAgenda: rec.noAgenda,
      namaPelanggan: rec.namaPelanggan,
      idPelPenanggung: rec.idPelPenanggung,
      alamatPenanggung: rec.alamatPenanggung,
      ke: ang.ke,
      bulan: ang.bulan,
      jatuhTempo: ang.jatuhTempo,
      nominal: ang.nominal,
    }))
  );

  return (
    <div className="min-h-screen bg-[#f8f9fe] text-[#32325d] pb-16">
      {/* Header Gradien Argon 4 */}
      <div className="bg-gradient-to-r from-[#5e72e4] to-[#825ee4] pt-8 pb-28 px-6 md:px-10 shadow-md">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-block px-3 py-1 text-xs font-bold tracking-wider uppercase bg-white/20 text-white rounded-full mb-2">
              PT PLN (Persero) • Sistem Otomasi Analitik P2TL
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Dashboard Rekap & Diagnosa Komprehensif P2TL
            </h1>
            <p className="text-white/85 text-sm mt-1">
              Ekstraksi otomatis Penetapan TS, SPH, & Surat Penanggung Hutang — Lengkap dengan Monitoring Cicilan & Salin Laporan WA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {allRecords.length > 0 && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Tambah File PDF Lagi
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-[#2dce89] hover:bg-[#24b374] text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Excel (.xlsx)
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 bg-[#f5365c] hover:bg-[#d92548] text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Kontainer Utama */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-10 -mt-20 space-y-6">
        {/* 4 Kartu Statistik Argon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Pelanggan
              </p>
              <h3 className="text-2xl font-extrabold text-[#32325d] mt-1">
                {totalPelanggan} <span className="text-sm font-normal text-slate-500">Agenda</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#5e72e4] to-[#825ee4] flex items-center justify-center text-white shadow-md">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Tagihan Susulan
              </p>
              <h3 className="text-xl font-extrabold text-[#2dce89] mt-1">
                {formatRp(totalTagihan)}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#2dce89] to-[#2dcecc] flex items-center justify-center text-white shadow-md">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Sisa Piutang SPH
              </p>
              <h3 className="text-xl font-extrabold text-[#fb6340] mt-1">
                {formatRp(totalSisaPiutang)}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#fb6340] to-[#fbb140] flex items-center justify-center text-white shadow-md">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Berkas Masuk
              </p>
              <h3 className="text-2xl font-extrabold text-[#11cdef] mt-1">
                {totalBerkasPDF} <span className="text-sm font-normal text-slate-500">File PDF</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#11cdef] to-[#1171ef] flex items-center justify-center text-white shadow-md">
              <Files className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Area Drag & Drop Multi-PDF */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`bg-white rounded-2xl p-6 border-2 border-dashed transition-all cursor-pointer shadow-sm text-center ${
            isDragging
              ? 'border-[#5e72e4] bg-[#5e72e4]/5 scale-[1.01]'
              : 'border-slate-300 hover:border-[#5e72e4]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="w-12 h-12 mx-auto rounded-full bg-[#5e72e4]/10 text-[#5e72e4] flex items-center justify-center mb-2">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h2 className="text-base md:text-lg font-bold text-[#32325d]">
            {isProcessing
              ? 'Sedang Mengekstrak Koordinat & Rincian Biaya PDF...'
              : 'Blok & Drop Semua File PDF P2TL ke Sini (Bisa Sekaligus Banyak)'}
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl mx-auto">
            Otomatis menggabungkan <strong>Penetapan TS</strong>, <strong>SPH</strong>, dan{' '}
            <strong>Surat Penanggung Hutang</strong> yang memiliki Nomor Agenda sama menjadi 1 baris utuh.
          </p>
        </div>

        {/* Area Konten Utama jika sudah ada data */}
        {allRecords.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            {/* Navigasi 3 Tab Utama */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 pt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('rekap')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs md:text-sm font-bold transition cursor-pointer border-b-2 ${
                    activeTab === 'rekap'
                      ? 'bg-white text-[#5e72e4] border-[#5e72e4] shadow-xs'
                      : 'text-slate-500 border-transparent hover:text-slate-800'
                  }`}
                >
                  <Table2 className="w-4 h-4" />
                  1. Tabel Rekap Pelanggan ({allRecords.length})
                </button>

                <button
                  onClick={() => setActiveTab('angsuran')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs md:text-sm font-bold transition cursor-pointer border-b-2 ${
                    activeTab === 'angsuran'
                      ? 'bg-white text-[#5e72e4] border-[#5e72e4] shadow-xs'
                      : 'text-slate-500 border-transparent hover:text-slate-800'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  2. Monitoring Jadwal Angsuran SPH ({allAngsuranRows.length} Cicilan)
                </button>

                <button
                  onClick={() => setActiveTab('statistik')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs md:text-sm font-bold transition cursor-pointer border-b-2 ${
                    activeTab === 'statistik'
                      ? 'bg-white text-[#5e72e4] border-[#5e72e4] shadow-xs'
                      : 'text-slate-500 border-transparent hover:text-slate-800'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  3. Ringkasan Golongan & Audit Berkas
                  {jumlahKurangBerkas > 0 && (
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-rose-500 text-white">
                      {jumlahKurangBerkas} Kurang
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ISI TAB 1: TABEL REKAP PELANGGAN */}
            {activeTab === 'rekap' && (
              <>
                {/* Bar Filter Cepat & Pencarian */}
                <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white">
                  {/* Tombol Filter Cepat (Pills) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setFilterStatus('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterStatus === 'ALL'
                          ? 'bg-[#5e72e4] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua ({allRecords.length})
                    </button>
                    <button
                      onClick={() => setFilterStatus('LENGKAP')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterStatus === 'LENGKAP'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Berkas Lengkap ({allRecords.length - jumlahKurangBerkas})
                    </button>
                    <button
                      onClick={() => setFilterStatus('KURANG')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterStatus === 'KURANG'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      Kurang Berkas ({jumlahKurangBerkas})
                    </button>
                    <button
                      onClick={() => setFilterStatus('SPH')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterStatus === 'SPH'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      Cicilan SPH ({allRecords.filter((r) => r.skemaPembayaran.includes('Angsuran')).length})
                    </button>
                    <button
                      onClick={() => setFilterStatus('NON_SPH')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterStatus === 'NON_SPH'
                          ? 'bg-teal-600 text-white'
                          : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                      }`}
                    >
                      Bayar Langsung ({allRecords.filter((r) => !r.skemaPembayaran.includes('Angsuran')).length})
                    </button>
                  </div>

                  {/* Input Cari & Filter Golongan */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari Nama / Agenda / IDPEL / Alamat..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#5e72e4] w-64"
                      />
                    </div>

                    <select
                      value={filterGolongan}
                      onChange={(e) => setFilterGolongan(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold focus:outline-none focus:border-[#5e72e4]"
                    >
                      <option value="ALL">Semua Golongan</option>
                      <option value="P1">Golongan P1</option>
                      <option value="P2">Golongan P2</option>
                      <option value="P3">Golongan P3</option>
                      <option value="P4">Golongan P4 (Non-Pelanggan)</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f6f9fc] text-[#8898aa] uppercase border-b border-slate-200">
                        <th className="py-3.5 px-4 font-bold">No</th>
                        <th className="py-3.5 px-4 font-bold min-w-[210px]">Administrasi & BA</th>
                        <th className="py-3.5 px-4 font-bold min-w-[230px]">Pelanggan & KTP</th>
                        <th className="py-3.5 px-4 font-bold min-w-[210px]">Rincian Biaya & kWh</th>
                        <th className="py-3.5 px-4 font-bold min-w-[220px]">Skema & Penanggung</th>
                        <th className="py-3.5 px-4 font-bold min-w-[180px]">Kelengkapan Berkas</th>
                        <th className="py-3.5 px-4 font-bold min-w-[320px]">Diagnosa, Solusi & Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((rec, idx) => (
                        <tr key={rec.noAgenda} className="hover:bg-slate-50/90 align-top">
                          <td className="py-4 px-4 font-bold text-slate-500">{idx + 1}</td>

                          {/* 1. Administrasi */}
                          <td className="py-4 px-4 space-y-1">
                            <div className="font-extrabold text-[#5e72e4] text-sm">{rec.noAgenda}</div>
                            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {rec.up3} / {rec.ulp}
                              </span>
                            </div>
                            <div className="text-slate-600">
                              <strong>No BA:</strong> {rec.noBA}{' '}
                              <span className="text-slate-400">({rec.tglBA})</span>
                            </div>
                            <div className="text-slate-600">
                              <strong>Penetapan:</strong> {rec.noPenetapan}
                            </div>
                            <div className="text-slate-600">
                              <strong>Tgl TS:</strong> {rec.tglPenetapan}
                            </div>
                            <div className="text-slate-600">
                              <strong>No Reg:</strong> {rec.noRegister}
                            </div>
                          </td>

                          {/* 2. Data Pelanggan & KTP */}
                          <td className="py-4 px-4 space-y-1">
                            <div className="font-extrabold text-[#32325d] text-sm">{rec.namaPelanggan}</div>
                            <div className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                              IDPEL: {rec.idPelangganTemuan} | {rec.tarifDaya}
                            </div>
                            <div className="text-slate-600 leading-snug">{rec.alamatTemuan}</div>
                            <div className="pt-1.5 mt-1.5 border-t border-slate-100 text-[11px] text-slate-500 space-y-0.5">
                              <div>
                                <strong>Penandatangan:</strong> {rec.namaKTP}
                              </div>
                              <div>
                                <strong>NIK KTP:</strong> {rec.noKTP}
                              </div>
                            </div>
                          </td>

                          {/* 3. Rincian Biaya & kWh */}
                          <td className="py-4 px-4 space-y-1">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fb6340]/15 text-[#fb6340]">
                              {rec.jenisGolongan}
                            </span>
                            <div className="font-extrabold text-sm text-[#2dce89] pt-0.5">
                              Total: {formatRp(rec.totalTagihan)}
                            </div>
                            <div className="text-slate-600 space-y-0.5 text-[11px]">
                              <div>
                                <strong>kWh Temuan:</strong> {rec.pemakaianKwh.toLocaleString('id-ID')} kWh
                              </div>
                              <div>
                                <strong>Biaya Beban:</strong> {formatRp(rec.biayaBeban)}
                              </div>
                              <div>
                                <strong>Biaya kWh:</strong> {formatRp(rec.biayaPemakaianKwh)}
                              </div>
                              <div>
                                <strong>Material & Segel:</strong> {formatRp(rec.biayaMaterial + rec.biayaSegel)}
                              </div>
                              <div>
                                <strong>PBJT-TL / PPJ:</strong> {formatRp(rec.biayaPPJ)}
                              </div>
                            </div>
                          </td>

                          {/* 4. Data Angsuran & Penanggung */}
                          <td className="py-4 px-4 space-y-1">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                rec.skemaPembayaran.includes('Angsuran')
                                  ? 'bg-[#5e72e4]/15 text-[#5e72e4]'
                                  : 'bg-[#2dce89]/15 text-[#2dce89]'
                              }`}
                            >
                              {rec.skemaPembayaran}
                            </span>

                            {rec.skemaPembayaran.includes('Angsuran') ? (
                              <div className="text-[11px] text-slate-600 space-y-0.5 pt-0.5">
                                <div>
                                  <strong>Uang Muka (DP):</strong> {formatRp(rec.uangMuka)}
                                </div>
                                <div>
                                  <strong>Sisa Piutang:</strong>{' '}
                                  <span className="font-bold text-[#f5365c]">{formatRp(rec.sisaHutang)}</span>
                                </div>
                                <div>
                                  <strong>Cicilan:</strong> {formatRp(rec.nominalCicilan)} / bln
                                </div>
                                <div className="text-slate-500">{rec.periodeAngsuran}</div>
                                {rec.idPelPenanggung !== '-' && (
                                  <div className="pt-1 mt-1 border-t border-slate-100 text-[#5e72e4]">
                                    <div>
                                      <strong>IDPEL Penanggung:</strong> {rec.idPelPenanggung}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{rec.alamatPenanggung}</div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 pt-1">
                                Pembayaran Langsung (Non-SPH). Jatuh tempo maks. 10 hari kerja sejak penetapan.
                              </div>
                            )}
                          </td>

                          {/* 5. Kelengkapan Berkas */}
                          <td className="py-4 px-4 space-y-1.5">
                            <div
                              className={`text-[11px] font-bold px-2 py-1 rounded ${
                                rec.statusKelengkapan.startsWith('LENGKAP')
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {rec.statusKelengkapan}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {rec.jenisDokumenMasuk.map((jenis) => (
                                <span
                                  key={jenis}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-[#5e72e4]"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {jenis}
                                </span>
                              ))}
                            </div>
                            <div className="space-y-0.5 pt-1">
                              {rec.namaFileMasuk.map((nf) => (
                                <div
                                  key={nf}
                                  className="flex items-center gap-1 text-[10px] text-slate-400 truncate max-w-[165px]"
                                  title={nf}
                                >
                                  <FileText className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{nf}</span>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* 6. Diagnosa, Solusi & Tombol Aksi */}
                          <td className="py-4 px-4 space-y-2">
                            <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-950 leading-relaxed">
                              <div className="font-bold flex items-center gap-1 text-amber-700 mb-0.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Diagnosa Masalah:
                              </div>
                              {rec.diagnosaMasalah}
                            </div>
                            <div className="bg-indigo-50/90 border border-indigo-200 rounded-lg p-2.5 text-[11px] text-indigo-950 leading-relaxed">
                              <div className="font-bold text-[#5e72e4] mb-0.5">
                                Rekomendasi Solusi & Tindak Lanjut:
                              </div>
                              {rec.rekomendasiSolusi}
                            </div>

                            {/* Deretan Tombol Aksi Cepat */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <button
                                onClick={() => setSelectedRecord(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#5e72e4] hover:bg-[#485fe0] text-white font-bold text-[11px] transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Rincian
                              </button>

                              <button
                                onClick={() => handleCopyWA(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer"
                              >
                                {copiedAgenda === rec.noAgenda ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    Tersalin!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    Salin WA
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => setEditingRecord({ ...rec })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit
                              </button>

                              <button
                                onClick={() => handleDeleteRow(rec.noAgenda)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] transition cursor-pointer"
                                title="Hapus Baris"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ISI TAB 2: MONITORING JADWAL ANGSURAN SPH */}
            {activeTab === 'angsuran' && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[#32325d]">
                    Tabel Monitoring Jatuh Tempo Cicilan Bulanan (Khusus Pelanggan SPH)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Seluruh jadwal angsuran pelanggan dari dokumen SPH otomatis terkumpul di sini untuk memudahkan pengawasan tanggal 20 setiap bulan.
                  </p>
                </div>

                {allAngsuranRows.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 rounded-xl">
                    Belum ada dokumen SPH (Surat Pengakuan Hutang) yang diunggah.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#f6f9fc] text-[#8898aa] uppercase border-b border-slate-200">
                          <th className="py-3 px-4">No</th>
                          <th className="py-3 px-4">No Agenda</th>
                          <th className="py-3 px-4">Nama Pelanggan</th>
                          <th className="py-3 px-4">IDPEL Penanggung</th>
                          <th className="py-3 px-4">Alamat Penanggung</th>
                          <th className="py-3 px-4">Cicilan Ke</th>
                          <th className="py-3 px-4">Bulan Rekening</th>
                          <th className="py-3 px-4">Tanggal Jatuh Tempo</th>
                          <th className="py-3 px-4">Nominal Cicilan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allAngsuranRows.map((row, i) => (
                          <tr key={`${row.noAgenda}-${row.ke}`} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 text-slate-400 font-bold">{i + 1}</td>
                            <td className="py-2.5 px-4 font-bold text-[#5e72e4]">{row.noAgenda}</td>
                            <td className="py-2.5 px-4 font-semibold">{row.namaPelanggan}</td>
                            <td className="py-2.5 px-4 font-bold">{row.idPelPenanggung}</td>
                            <td className="py-2.5 px-4 text-slate-500">{row.alamatPenanggung}</td>
                            <td className="py-2.5 px-4 font-bold text-indigo-600">Angsuran ke-{row.ke}</td>
                            <td className="py-2.5 px-4">{row.bulan}</td>
                            <td className="py-2.5 px-4 font-semibold text-rose-600">{row.jatuhTempo}</td>
                            <td className="py-2.5 px-4 font-extrabold text-[#2dce89]">{formatRp(row.nominal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ISI TAB 3: RINGKASAN STATISTIK & AUDIT KELENGKAPAN BERKAS */}
            {activeTab === 'statistik' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#32325d] mb-3">
                    Rekapitulasi Per Golongan Penetapan (P1 / P2 / P3 / P4)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(['P1', 'P2', 'P3', 'P4'] as const).map((gol) => {
                      const subset = allRecords.filter((r) => r.golongan === gol);
                      const sumTS = subset.reduce((s, r) => s + r.totalTagihan, 0);
                      const sumKwh = subset.reduce((s, r) => s + r.pemakaianKwh, 0);
                      return (
                        <div key={gol} className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#5e72e4]/15 text-[#5e72e4]">
                              Golongan {gol}
                            </span>
                            <span className="text-sm font-extrabold text-[#32325d]">
                              {subset.length} Pelanggan
                            </span>
                          </div>
                          <div className="pt-2 text-base font-extrabold text-[#2dce89]">
                            {formatRp(sumTS)}
                          </div>
                          <div className="text-xs text-slate-500">
                            Total Energi: <strong>{sumKwh.toLocaleString('id-ID')} kWh</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Daftar Peringatan Kurang Berkas */}
                <div>
                  <h3 className="text-base font-bold text-[#32325d] mb-2">
                    Audit Kelengkapan Berkas PDF Pelanggan
                  </h3>
                  {jumlahKurangBerkas === 0 ? (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Seluruh pelanggan ({allRecords.length} Agenda) sudah memiliki berkas PDF yang lengkap!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allRecords
                        .filter((r) => r.statusKelengkapan.startsWith('KURANG'))
                        .map((r) => (
                          <div
                            key={r.noAgenda}
                            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-extrabold text-rose-700">{r.noAgenda}</span> —{' '}
                              <strong className="text-slate-800">{r.namaPelanggan}</strong> ({r.jenisGolongan})
                              <div className="text-rose-600 mt-0.5">{r.statusKelengkapan}</div>
                            </div>
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shrink-0"
                            >
                              + Upload Berkas Susulan
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: LIHAT RINCIAN PERHITUNGAN & JADWAL ANGSURAN */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-[#5e72e4] to-[#825ee4] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider opacity-80">
                  Rincian Dokumen P2TL • {selectedRecord.up3} / {selectedRecord.ulp}
                </span>
                <h3 className="text-lg font-extrabold">{selectedRecord.noAgenda}</h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#5e72e4] uppercase mb-1">1. Data Pelanggan Temuan</div>
                  <div>
                    <strong>IDPEL Temuan:</strong> {selectedRecord.idPelangganTemuan}
                  </div>
                  <div>
                    <strong>Nama:</strong> {selectedRecord.namaPelanggan}
                  </div>
                  <div>
                    <strong>Tarif / Daya:</strong> {selectedRecord.tarifDaya}
                  </div>
                  <div>
                    <strong>Alamat Temuan:</strong> {selectedRecord.alamatTemuan}
                  </div>
                  <div>
                    <strong>No & Tgl BA:</strong> {selectedRecord.noBA} ({selectedRecord.tglBA})
                  </div>
                  <div>
                    <strong>No Register:</strong> {selectedRecord.noRegister}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#5e72e4] uppercase mb-1">2. Penandatangan & Penanggung</div>
                  <div>
                    <strong>Nama Sesuai KTP:</strong> {selectedRecord.namaKTP}
                  </div>
                  <div>
                    <strong>No KTP:</strong> {selectedRecord.noKTP}
                  </div>
                  <div>
                    <strong>Alamat KTP:</strong> {selectedRecord.alamatKTP}
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 mt-1.5">
                    <div>
                      <strong>IDPEL Penanggung:</strong> {selectedRecord.idPelPenanggung}
                    </div>
                    <div>
                      <strong>Nama Penanggung:</strong> {selectedRecord.namaPenanggung} (
                      {selectedRecord.tarifDayaPenanggung})
                    </div>
                    <div>
                      <strong>Alamat Penanggung:</strong> {selectedRecord.alamatPenanggung}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#5e72e4] uppercase mb-1">3. Rumus & Komponen Tagihan</div>
                  <div>
                    <strong>Golongan:</strong> {selectedRecord.jenisGolongan}
                  </div>
                  <div>
                    <strong>Rumus Beban:</strong> {selectedRecord.rumusBeban}
                  </div>
                  <div>
                    <strong>Rumus kWh:</strong> {selectedRecord.rumusKwh}
                  </div>
                  <div>
                    <strong>Biaya Beban:</strong> {formatRp(selectedRecord.biayaBeban)}
                  </div>
                  <div>
                    <strong>Biaya kWh ({selectedRecord.pemakaianKwh} kWh):</strong>{' '}
                    {formatRp(selectedRecord.biayaPemakaianKwh)}
                  </div>
                  <div>
                    <strong>Material + Segel + PPJ:</strong>{' '}
                    {formatRp(selectedRecord.biayaMaterial + selectedRecord.biayaSegel + selectedRecord.biayaPPJ)}
                  </div>
                  <div className="font-extrabold text-sm text-[#2dce89] pt-1">
                    Total TS: {formatRp(selectedRecord.totalTagihan)}
                  </div>
                </div>
              </div>

              {selectedRecord.rincianAngsuran.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-[#32325d] mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#5e72e4]" />
                    Jadwal Rincian Angsuran Bulanan (SPH) — DP: {formatRp(selectedRecord.uangMuka)} | Sisa Piutang:{' '}
                    {formatRp(selectedRecord.sisaHutang)}
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 uppercase text-[11px]">
                          <th className="py-2.5 px-4">Angsuran Ke</th>
                          <th className="py-2.5 px-4">Rekening Bulan</th>
                          <th className="py-2.5 px-4">Tanggal Jatuh Tempo</th>
                          <th className="py-2.5 px-4">Nominal Tagihan (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedRecord.rincianAngsuran.map((item) => (
                          <tr key={item.ke} className="hover:bg-slate-50">
                            <td className="py-2 px-4 font-bold text-[#5e72e4]">Angsuran ke-{item.ke}</td>
                            <td className="py-2 px-4">{item.bulan}</td>
                            <td className="py-2 px-4 text-rose-600 font-semibold">{item.jatuhTempo}</td>
                            <td className="py-2 px-4 font-bold">{formatRp(item.nominal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200 pt-3">
                <span>
                  Pejabat Mengetahui / Manager: <strong>{selectedRecord.manager}</strong>
                </span>
                <span>
                  Cetakan Sistem: <strong>{selectedRecord.petugasCetak}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT MANUAL DATA PELANGGAN & CATATAN SOLUSI */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-[#5e72e4] to-[#825ee4] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider opacity-80">
                  Edit Data & Catatan Manual
                </span>
                <h3 className="text-lg font-extrabold">{editingRecord.noAgenda}</h3>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Nama Pelanggan Temuan</label>
                  <input
                    type="text"
                    value={editingRecord.namaPelanggan}
                    onChange={(e) => setEditingRecord({ ...editingRecord, namaPelanggan: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">ID Pelanggan Temuan</label>
                  <input
                    type="text"
                    value={editingRecord.idPelangganTemuan}
                    onChange={(e) => setEditingRecord({ ...editingRecord, idPelangganTemuan: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">No Berita Acara</label>
                  <input
                    type="text"
                    value={editingRecord.noBA}
                    onChange={(e) => setEditingRecord({ ...editingRecord, noBA: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">IDPEL Penanggung Hutang</label>
                  <input
                    type="text"
                    value={editingRecord.idPelPenanggung}
                    onChange={(e) => setEditingRecord({ ...editingRecord, idPelPenanggung: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Diagnosa Masalah Utama</label>
                <textarea
                  rows={3}
                  value={editingRecord.diagnosaMasalah}
                  onChange={(e) => setEditingRecord({ ...editingRecord, diagnosaMasalah: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Rekomendasi Solusi & Tindak Lanjut</label>
                <textarea
                  rows={3}
                  value={editingRecord.rekomendasiSolusi}
                  onChange={(e) => setEditingRecord({ ...editingRecord, rekomendasiSolusi: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-5 py-2 rounded-lg bg-[#2dce89] hover:bg-[#24b374] text-white font-bold cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}