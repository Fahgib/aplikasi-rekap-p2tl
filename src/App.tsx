import { useState, useRef } from 'react';
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
} from 'lucide-react';
import type { P2TLRecord } from './types/p2tl';
import { processP2TLFiles } from './utils/p2tlParser';

export default function App() {
  const [recordMap, setRecordMap] = useState<Map<string, P2TLRecord>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGolongan, setFilterGolongan] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState<P2TLRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allRecords = Array.from(recordMap.values());

  // Filter pencarian & golongan
  const records = allRecords.filter((rec) => {
    const matchGol = filterGolongan === 'ALL' || rec.golongan === filterGolongan;
    const q = searchQuery.toLowerCase();
    const matchQuery =
      !q ||
      rec.noAgenda.toLowerCase().includes(q) ||
      rec.namaPelanggan.toLowerCase().includes(q) ||
      rec.namaKTP.toLowerCase().includes(q) ||
      rec.idPelangganTemuan.toLowerCase().includes(q) ||
      rec.idPelPenanggung.toLowerCase().includes(q) ||
      rec.noBA.toLowerCase().includes(q);
    return matchGol && matchQuery;
  });

  // Ringkasan Kartu Statistik Argon
  const totalPelanggan = allRecords.length;
  const totalTagihan = allRecords.reduce((acc, r) => acc + r.totalTagihan, 0);
  const totalSisaPiutang = allRecords.reduce((acc, r) => acc + r.sisaHutang, 0);
  const totalBerkasPDF = allRecords.reduce((acc, r) => acc + r.namaFileMasuk.length, 0);

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

  // Export ke Excel (.xlsx) dengan 3 Sheet Kompleks & Lengkap
  const handleExportExcel = () => {
    if (allRecords.length === 0) return;

    // SHEET 1: REKAP UTAMA P2TL (32 KOLOM LENGKAP)
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
      { wch: 8 },  // No Urut
      { wch: 28 }, // Unit PLN
      { wch: 28 }, // No Agenda
      { wch: 18 }, // No BA
      { wch: 15 }, // Tgl BA
      { wch: 24 }, // No Penetapan
      { wch: 16 }, // Tgl Penetapan
      { wch: 18 }, // No Register
      { wch: 18 }, // IDPEL Temuan
      { wch: 24 }, // Nama Pelanggan
      { wch: 42 }, // Alamat Temuan
      { wch: 15 }, // Tarif / Daya
      { wch: 26 }, // Nama KTP
      { wch: 20 }, // No KTP
      { wch: 42 }, // Alamat KTP
      { wch: 20 }, // Jenis & Golongan
      { wch: 45 }, // Rumus Perhitungan
      { wch: 15 }, // Pemakaian kWh
      { wch: 22 }, // Biaya Beban
      { wch: 22 }, // Biaya kWh
      { wch: 22 }, // Subtotal
      { wch: 18 }, // Biaya Material
      { wch: 18 }, // Biaya Segel
      { wch: 18 }, // Biaya PPJ
      { wch: 22 }, // Total TS
      { wch: 45 }, // Terbilang
      { wch: 22 }, // Skema Pembayaran
      { wch: 20 }, // IDPEL Penanggung
      { wch: 28 }, // Nama & Tarif Penanggung
      { wch: 38 }, // Alamat Penanggung
      { wch: 20 }, // Uang Muka
      { wch: 22 }, // Sisa Hutang
      { wch: 16 }, // Tenor
      { wch: 22 }, // Nominal Cicilan
      { wch: 34 }, // Periode Angsuran
      { wch: 45 }, // Pejabat & Petugas
      { wch: 38 }, // Status Kelengkapan
      { wch: 38 }, // Daftar File
      { wch: 65 }, // Diagnosa
      { wch: 70 }, // Solusi
    ];

    // SHEET 2: JADWAL MONITORING ANGSURAN BULANAN (KHUSUS SPH)
    const sheet2Data: any[] = [];
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
      setSelectedRecord(null);
    }
  };

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
              Ekstraksi presisi berbasis koordinat PDF untuk Penetapan TS, SPH, & Surat Kesediaan Penanggung Hutang.
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
                  onClick={handleReset}
                  className="flex items-center gap-2 bg-[#f5365c] hover:bg-[#d92548] text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Reset / Bersihkan
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
          className={`bg-white rounded-2xl p-7 border-2 border-dashed transition-all cursor-pointer shadow-sm text-center ${
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
          <div className="w-14 h-14 mx-auto rounded-full bg-[#5e72e4]/10 text-[#5e72e4] flex items-center justify-center mb-2.5">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h2 className="text-base md:text-lg font-bold text-[#32325d]">
            {isProcessing
              ? 'Sedang Mengekstrak Koordinat & Rincian Biaya PDF...'
              : 'Blok & Drop Semua File PDF P2TL ke Sini'}
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl mx-auto">
            Mendukung penggabungan otomatis multi-berkas (<strong>Penetapan TS</strong>, <strong>SPH</strong>, dan{' '}
            <strong>Surat Penanggung Hutang</strong>) tanpa ada data yang terlewat.
          </p>
        </div>

        {/* Tabel Hasil Rekap Lengkap */}
        {allRecords.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            {/* Bar Kontrol, Filter & Tombol Download Excel */}
            <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#32325d]">
                  Hasil Penggabungan & Diagnosa Otomatis ({records.length} dari {allRecords.length} Pelanggan)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  File Excel yang diunduh memiliki 3 Sheet (Rekap Utama 32 Kolom, Jadwal Angsuran SPH, & Ringkasan Statistik).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Pencarian */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari Nama / No Agenda / IDPEL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#5e72e4] w-56"
                  />
                </div>

                {/* Filter Golongan */}
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

                <button
                  onClick={handleExportExcel}
                  className="flex items-center justify-center gap-2 bg-[#2dce89] hover:bg-[#24b374] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Rekap Excel (3 Sheet .xlsx)
                </button>
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
                    <th className="py-3.5 px-4 font-bold min-w-[300px]">Diagnosa & Tindak Lanjut</th>
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
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {rec.up3} • {rec.ulp}
                        </div>
                        <div className="text-slate-600">
                          <strong>No BA:</strong> {rec.noBA} <span className="text-slate-400">({rec.tglBA})</span>
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
                          IDPEL: {rec.idPelangganTemuan} • {rec.tarifDaya}
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

                        <button
                          onClick={() => setSelectedRecord(rec)}
                          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-[#5e72e4] hover:text-white text-slate-700 font-bold text-[11px] transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Lihat Rincian Lengkap
                        </button>
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

                      {/* 6. Diagnosa & Solusi */}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail Rincian Perhitungan & Jadwal Angsuran */}
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
              {/* Grid Informasi Lengkap */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#5e72e4] uppercase mb-1">1. Data Pelanggan Temuan</div>
                  <div><strong>IDPEL Temuan:</strong> {selectedRecord.idPelangganTemuan}</div>
                  <div><strong>Nama:</strong> {selectedRecord.namaPelanggan}</div>
                  <div><strong>Tarif / Daya:</strong> {selectedRecord.tarifDaya}</div>
                  <div><strong>Alamat Temuan:</strong> {selectedRecord.alamatTemuan}</div>
                  <div><strong>No & Tgl BA:</strong> {selectedRecord.noBA} ({selectedRecord.tglBA})</div>
                  <div><strong>No Register:</strong> {selectedRecord.noRegister}</div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#5e72e4] uppercase mb-1">2. Penandatangan & Penanggung</div>
                  <div><strong>Nama Sesuai KTP:</strong> {selectedRecord.namaKTP}</div>
                  <div><strong>No KTP:</strong> {selectedRecord.noKTP}</div>
                  <div><strong>Alamat KTP:</strong> {selectedRecord.alamatKTP}</div>
                  <div className="border-t border-slate-200 pt-1.5 mt-1.5">
                    <div><strong>IDPEL Penanggung:</strong> {selectedRecord.idPelPenanggung}</div>
                    <div><strong>Nama Penanggung:</strong> {selectedRecord.namaPenanggung} ({selectedRecord.tarifDayaPenanggung})</div>
                    <div><strong>Alamat Penanggung:</strong> {selectedRecord.alamatPenanggung}</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-bold text-[#5e72e4] uppercase mb-1">3. Rumus & Komponen Tagihan</div>
                  <div><strong>Golongan:</strong> {selectedRecord.jenisGolongan}</div>
                  <div><strong>Rumus Beban:</strong> {selectedRecord.rumusBeban}</div>
                  <div><strong>Rumus kWh:</strong> {selectedRecord.rumusKwh}</div>
                  <div><strong>Biaya Beban:</strong> {formatRp(selectedRecord.biayaBeban)}</div>
                  <div><strong>Biaya kWh ({selectedRecord.pemakaianKwh} kWh):</strong> {formatRp(selectedRecord.biayaPemakaianKwh)}</div>
                  <div><strong>Material + Segel + PPJ:</strong> {formatRp(selectedRecord.biayaMaterial + selectedRecord.biayaSegel + selectedRecord.biayaPPJ)}</div>
                  <div className="font-extrabold text-sm text-[#2dce89] pt-1">
                    Total TS: {formatRp(selectedRecord.totalTagihan)}
                  </div>
                </div>
              </div>

              {/* Tabel Jadwal 12 Angsuran jika ada SPH */}
              {selectedRecord.rincianAngsuran.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-[#32325d] mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#5e72e4]" />
                    Jadwal Rincian Angsuran Bulanan (SPH) — DP: {formatRp(selectedRecord.uangMuka)} | Sisa Piutang: {formatRp(selectedRecord.sisaHutang)}
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
                <span>Pejabat Mengetahui / Manager: <strong>{selectedRecord.manager}</strong></span>
                <span>Cetakan Sistem: <strong>{selectedRecord.petugasCetak}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}