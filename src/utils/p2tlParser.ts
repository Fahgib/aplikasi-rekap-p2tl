import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { P2TLRecord, AngsuranItem } from '../types/p2tl';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface TextItemWithCoords {
  x: number;
  y: number;
  str: string;
}

interface StructuredRow {
  y: number;
  full: string;
  left: string;   // Kolom kiri (x < 315)
  right: string;  // Kolom kanan (x >= 315)
  items: TextItemWithCoords[];
}

function parseRupiah(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

// Mengekstrak baris teks berdasarkan koordinat (Y atas-ke-bawah, X kiri-ke-kanan)
async function extractStructuredRowsFromPDF(file: File): Promise<StructuredRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allRows: StructuredRow[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const rawItems: TextItemWithCoords[] = [];

    for (const item of content.items as any[]) {
      const str = (item.str || '').trim();
      if (!str || str.toLowerCase() === 'scan me' || str === '车') continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      rawItems.push({ x, y, str });
    }

    // Kelompokkan item yang berada pada baris Y yang sama (toleransi 4 poin)
    const pageRows: { y: number; items: TextItemWithCoords[] }[] = [];
    for (const it of rawItems) {
      const existingRow = pageRows.find((r) => Math.abs(r.y - it.y) <= 4.0);
      if (existingRow) {
        // Cegah duplikasi teks bold yang digambar 2x di koordinat X yang sama
        const isDuplicate = existingRow.items.some(
          (ex) => Math.abs(ex.x - it.x) < 3.0 && ex.str === it.str
        );
        if (!isDuplicate) {
          existingRow.items.push(it);
        }
      } else {
        pageRows.push({ y: it.y, items: [it] });
      }
    }

    // Urutkan baris dari atas ke bawah (Y terbesar ke terkecil)
    pageRows.sort((a, b) => b.y - a.y);

    for (const r of pageRows) {
      // Urutkan kata dari kiri ke kanan (X terkecil ke terbesar)
      r.items.sort((a, b) => a.x - b.x);
      const full = r.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      const left = r.items
        .filter((i) => i.x < 315)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const right = r.items
        .filter((i) => i.x >= 315)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      allRows.push({
        y: r.y,
        full,
        left,
        right,
        items: r.items,
      });
    }
  }

  return allRows;
}

function createEmptyRecord(noAgenda: string): P2TLRecord {
  return {
    noAgenda,
    up3: '-',
    ulp: '-',
    noBA: '-',
    tglBA: '-',
    noPenetapan: '-',
    tglPenetapan: '-',
    noRegister: '-',
    idPelangganTemuan: '-',
    namaPelanggan: '-',
    alamatTemuan: '-',
    tarifDaya: '-',
    namaKTP: '-',
    noKTP: '-',
    alamatKTP: '-',
    jenisPenetapan: 'Pelanggaran',
    golongan: '-',
    jenisGolongan: '-',
    rumusBeban: '-',
    rumusKwh: '-',
    pemakaianKwh: 0,
    biayaBeban: 0,
    biayaPemakaianKwh: 0,
    subtotalBebanKwh: 0,
    biayaMaterial: 0,
    biayaSegel: 0,
    biayaPPJ: 0,
    biayaLainnya: 0,
    totalTagihan: 0,
    terbilang: '-',
    skemaPembayaran: 'Langsung / Non-Angsuran',
    idPelPenanggung: '-',
    namaPenanggung: '-',
    alamatPenanggung: '-',
    tarifDayaPenanggung: '-',
    uangMuka: 0,
    sisaHutang: 0,
    tenorBulan: 0,
    nominalCicilan: 0,
    nominalCicilanAkhir: 0,
    periodeAngsuran: '-',
    rincianAngsuran: [],
    manager: '-',
    petugasCetak: '-',
    jenisDokumenMasuk: [],
    namaFileMasuk: [],
    statusKelengkapan: '-',
    diagnosaMasalah: '-',
    rekomendasiSolusi: '-',
  };
}

function finalizeAndDiagnose(rec: P2TLRecord) {
  // Sinkronisasi perhitungan apabila ada nilai yang berasal dari SPH saja
  if (rec.subtotalBebanKwh === 0 && (rec.biayaBeban > 0 || rec.biayaPemakaianKwh > 0)) {
    rec.subtotalBebanKwh = rec.biayaBeban + rec.biayaPemakaianKwh;
  }
  if (rec.totalTagihan > 0 && rec.uangMuka > 0) {
    rec.sisaHutang = rec.totalTagihan - rec.uangMuka;
  }
  if (rec.namaPelanggan === '-' && rec.namaKTP !== '-') {
    rec.namaPelanggan = rec.namaKTP;
  }
  if (rec.alamatTemuan === '-' && rec.alamatKTP !== '-') {
    rec.alamatTemuan = rec.alamatKTP;
  }

  const gol = rec.golongan.toUpperCase();
  const isNonPelanggan = rec.idPelangganTemuan.includes('NONPELANGGAN') || gol === 'P4';
  const hasPenetapan = rec.jenisDokumenMasuk.includes('Penetapan TS');
  const hasSPH = rec.jenisDokumenMasuk.includes('SPH');
  const hasSPPenanggung = rec.jenisDokumenMasuk.includes('SP Penanggung');

  // Evaluasi Status Kelengkapan Berkas
  if (isNonPelanggan && rec.skemaPembayaran === 'Angsuran (SPH)') {
    const lengkap = hasPenetapan && hasSPH && hasSPPenanggung;
    rec.statusKelengkapan = lengkap
      ? 'LENGKAP (3/3: Penetapan TS, SPH, SP Penanggung)'
      : `KURANG BERKAS (${rec.jenisDokumenMasuk.length}/3: ${rec.jenisDokumenMasuk.join(', ')})`;
  } else if (rec.skemaPembayaran === 'Angsuran (SPH)') {
    const lengkap = hasPenetapan && hasSPH;
    rec.statusKelengkapan = lengkap
      ? 'LENGKAP (Penetapan TS & SPH)'
      : `KURANG BERKAS (${rec.jenisDokumenMasuk.join(', ')})`;
  } else {
    rec.statusKelengkapan = hasPenetapan
      ? 'LENGKAP (Penetapan TS Non-Angsuran)'
      : `KURANG BERKAS (${rec.jenisDokumenMasuk.join(', ')})`;
  }

  // 1. Diagnosa Masalah Utama Secara Detail
  if (gol === 'P1') {
    rec.diagnosaMasalah = `Pelanggaran Golongan I (P1) pada IDPEL ${rec.idPelangganTemuan} (${rec.tarifDaya}): Ditemukan pelanggaran yang mempengaruhi batas daya (MCB/pembatas arus tidak sesuai kontrak). Dikenakan Biaya Beban Susulan Rp ${rec.biayaBeban.toLocaleString('id-ID')} tanpa tagihan kWh tambahan.`;
  } else if (gol === 'P2') {
    rec.diagnosaMasalah = `Pelanggaran Golongan II (P2) pada IDPEL ${rec.idPelangganTemuan} (${rec.tarifDaya}): Ditemukan pelanggaran yang mempengaruhi pengukuran energi (kWh Meter) sebesar ${rec.pemakaianKwh.toLocaleString('id-ID')} kWh.`;
  } else if (gol === 'P3') {
    rec.diagnosaMasalah = `Pelanggaran Golongan III (P3) pada IDPEL ${rec.idPelangganTemuan} (${rec.tarifDaya}): Pelanggaran mempengaruhi batas daya sekaligus pengukuran energi sebesar ${rec.pemakaianKwh.toLocaleString('id-ID')} kWh.`;
  } else if (isNonPelanggan) {
    rec.diagnosaMasalah = `Pelanggaran Golongan IV (P4 - Non Pelanggan) atas nama ${rec.namaPelanggan} (Daya Kedapatan ${rec.tarifDaya}): Pemakaian tenaga listrik tanpa hak/sambungan langsung tanpa IDPEL resmi. Beban energi terhitung ${rec.pemakaianKwh.toLocaleString('id-ID')} kWh dengan total TS Rp ${rec.totalTagihan.toLocaleString('id-ID')}.`;
  } else {
    rec.diagnosaMasalah = `Temuan P2TL Agenda ${rec.noAgenda} dengan total penetapan Rp ${rec.totalTagihan.toLocaleString('id-ID')}.`;
  }

  // 2. Rekomendasi Solusi & Tindak Lanjut Operasional
  const solusi: string[] = [];
  if (isNonPelanggan) {
    if (rec.idPelPenanggung !== '-') {
      solusi.push(
        `Sisa piutang Rp ${rec.sisaHutang.toLocaleString('id-ID')} (setelah DP Rp ${rec.uangMuka.toLocaleString('id-ID')}) dibebankan ke IDPEL Penanggung ${rec.idPelPenanggung} (${rec.alamatPenanggung}) selama ${rec.periodeAngsuran} sebesar Rp ${rec.nominalCicilan.toLocaleString('id-ID')}/bln.`
      );
      solusi.push(
        'Awasi pembayaran sebelum tanggal 20 setiap bulan; jika menunggak >60 hari sejak putus sementara, lakukan bongkar rampung pada IDPEL Penanggung.'
      );
    } else {
      solusi.push(
        'Tagih pelunasan tunai atau wajibkan penunjukan IDPEL Penanggung Hutang, serta arahkan pengajuan Pasang Baru (PB) resmi.'
      );
    }
  } else {
    if (rec.skemaPembayaran === 'Angsuran (SPH)') {
      solusi.push(
        `Pantau pembayaran DP Rp ${rec.uangMuka.toLocaleString('id-ID')} dan cicilan ${rec.periodeAngsuran} (@ Rp ${rec.nominalCicilan.toLocaleString('id-ID')}/bln) sebelum tanggal 20.`
      );
    } else {
      solusi.push(
        `Penagihan Langsung (Non-SPH) senilai Rp ${rec.totalTagihan.toLocaleString('id-ID')} (termasuk Material Rp ${rec.biayaMaterial.toLocaleString('id-ID')} & Segel Rp ${rec.biayaSegel.toLocaleString('id-ID')}). Pastikan pelunasan maksimal 10 hari kerja & normalisasi APP/segel.`
      );
    }
  }

  if (rec.statusKelengkapan.startsWith('KURANG')) {
    solusi.push(`TINDAK LANJUT BERKAS: Segera lengkapi dokumen PDF yang belum diunggah (${rec.statusKelengkapan}).`);
  }

  rec.rekomendasiSolusi = solusi.join(' ');
}

export async function processP2TLFiles(
  files: File[],
  existingMap?: Map<string, P2TLRecord>
): Promise<Map<string, P2TLRecord>> {
  const recordMap = existingMap ? new Map(existingMap) : new Map<string, P2TLRecord>();

  for (const file of files) {
    const rows = await extractStructuredRowsFromPDF(file);
    const fullText = rows.map((r) => r.full).join('\n');

    const agendaMatch = fullText.match(/P2TL\/\d+\/\d+\/\d+/i);
    if (!agendaMatch) continue;

    const noAgenda = agendaMatch[0].toUpperCase();
    const rec = recordMap.get(noAgenda) || createEmptyRecord(noAgenda);

    if (!rec.namaFileMasuk.includes(file.name)) {
      rec.namaFileMasuk.push(file.name);
    }

    const isSPPenanggung = fullText.includes('SURAT PERNYATAAN KESEDIAAN');
    const isPenetapan = fullText.includes('PENETAPAN TAGIHAN SUSULAN');
    const isSPH = fullText.includes('SURAT PENGAKUAN HUTANG');

    // Ekstrak Header Unit (UP3 / ULP), KTP, Manager, dan Petugas Cetak
    for (let i = 0; i < rows.length; i++) {
      const f = rows[i].full;
      const left = rows[i].left;
      const right = rows[i].right;

      if (/^UP3\s+/i.test(f)) rec.up3 = f;
      if (/^ULP\s+/i.test(f)) rec.ulp = f;

      const mKtp = f.match(/No KTP\s*:\s*(\d{10,20})/i);
      if (mKtp) rec.noKTP = mKtp[1].trim();

      const mNamaKtp = f.match(/Nama\s+Sesuai\s+KTP\s*:\s*(.+)/i);
      if (mNamaKtp) rec.namaKTP = mNamaKtp[1].trim();

      const mAlamatKtp = f.match(/Alamat\s+Sesuai\s+KTP\s*:\s*(.+)/i);
      if (mAlamatKtp) rec.alamatKTP = mAlamatKtp[1].trim();

      if (f.includes('Cetakan ke')) {
        rec.petugasCetak = f.split('/ Cetakan')[0].trim();
      }

      // Deteksi Nama Manager sesuai posisi kolom kata "Manager"
      if (left === 'Manager' || right === 'Manager') {
        const managerOnLeft = left === 'Manager';
        for (let k = i + 1; k < Math.min(i + 5, rows.length); k++) {
          const candidate = managerOnLeft ? rows[k].left : rows[k].right;
          if (
            candidate &&
            !candidate.includes('Untuk memperoleh') &&
            !candidate.includes('TIDAK DIPUNGUT') &&
            !candidate.includes('Meterai') &&
            !candidate.includes('Cetakan')
          ) {
            rec.manager = candidate.trim();
            break;
          }
        }
      }
    }

    // 1. DOKUMEN SURAT PERNYATAAN KESEDIAAN PENANGGUNG HUTANG
    if (isSPPenanggung) {
      if (!rec.jenisDokumenMasuk.includes('SP Penanggung')) {
        rec.jenisDokumenMasuk.push('SP Penanggung');
      }
      rec.skemaPembayaran = 'Angsuran (SPH)';

      for (const r of rows) {
        const f = r.full;
        const mSisa = f.match(/senilai\s+Rp\s*([\d.,]+)\s*untuk\s+dibayarkan\s+secara\s+cicilan/i);
        if (mSisa) rec.sisaHutang = parseRupiah(mSisa[1]);

        const mId = f.match(/^ID Pelanggan\s*:\s*(\d+)/i);
        if (mId) rec.idPelPenanggung = mId[1].trim();

        const mNamaP = f.match(/^Nama\s*:\s*(.+)/i);
        if (mNamaP) rec.namaPenanggung = mNamaP[1].trim();

        const mAlamatP = f.match(/^Alamat\s*:\s*(.+)/i);
        if (mAlamatP) {
          rec.alamatPenanggung = mAlamatP[1].replace(/\s*KetNo\.?\s*$/i, '').trim();
        }

        const mTdP = f.match(/^Tarif\s*\/\s*Daya\s*:\s*(.+)/i);
        if (mTdP) rec.tarifDayaPenanggung = mTdP[1].replace(/\s+/g, '');
      }
    }

    // 2. DOKUMEN PENETAPAN TAGIHAN SUSULAN
    if (isPenetapan) {
      if (!rec.jenisDokumenMasuk.includes('Penetapan TS')) {
        rec.jenisDokumenMasuk.push('Penetapan TS');
      }

      let inBiayaBebanSection = false;
      let inBiayaLainSection = false;

      for (let i = 0; i < rows.length; i++) {
        const { full: f, left, right } = rows[i];

        if (f.includes('BIAYA BEBAN / REKENING MINIMUM DAN BIAYA PEMAKAIAN')) {
          inBiayaBebanSection = true;
          inBiayaLainSection = false;
        } else if (f.includes('BIAYA LAIN - LAIN')) {
          inBiayaBebanSection = false;
          inBiayaLainSection = true;
        } else if (f.includes('TOTAL BIAYA')) {
          inBiayaBebanSection = false;
          inBiayaLainSection = false;
        }

        const mNoPen = f.match(/Nomor\s*:\s*([^\s,]+)\s*,\s*Tanggal\s*:\s*([\d-]+)/i);
        if (mNoPen) {
          rec.noPenetapan = mNoPen[1].trim();
          rec.tglPenetapan = mNoPen[2].trim();
        }

        // Kolom Kiri: Data Pelanggan Temuan
        const mIdTem = (left || f).match(/ID Pelanggan\s*\/\s*No Meter\s*:\s*([A-Z0-9]+)/i);
        if (mIdTem) rec.idPelangganTemuan = mIdTem[1].trim();

        const mNamaTem = left.match(/^Nama\s*:\s*(.+)/i);
        if (mNamaTem) rec.namaPelanggan = mNamaTem[1].trim();

        const mAlamatTem = left.match(/^Alamat\s*:\s*(.+)/i);
        if (mAlamatTem) {
          let addr = mAlamatTem[1].trim();
          if (
            i + 1 < rows.length &&
            rows[i + 1].left &&
            !rows[i + 1].left.includes(':') &&
            !rows[i + 1].left.includes('Tarif')
          ) {
            addr += ' ' + rows[i + 1].left.trim();
          }
          rec.alamatTemuan = addr;
        }

        // Kolom Kanan: Data Berita Acara & Register
        const mBA = (right || f).match(/No Berita Acara\s*:\s*(.+)/i);
        if (mBA) rec.noBA = mBA[1].trim();

        const mTglBA = (right || f).match(/Tgl Berita Acara\s*:\s*([\d-]+)/i);
        if (mTglBA) rec.tglBA = mTglBA[1].trim();

        const mReg = (right || f).match(/No Register\s*:\s*(\d+)/i);
        if (mReg) rec.noRegister = mReg[1].trim();

        const mTarif = f.match(/Tarif\s*\/\s*Daya\s*:\s*(.+)/i);
        if (mTarif) rec.tarifDaya = mTarif[1].replace(/\s+/g, '');

        const mJenis = f.match(/Jenis Penetapan\s*:\s*(.+)/i);
        if (mJenis) rec.jenisPenetapan = mJenis[1].trim();

        const mGol = f.match(/Golongan Penetapan\s*:\s*(P[1-4])/i);
        if (mGol) {
          rec.golongan = mGol[1].toUpperCase();
          rec.jenisGolongan = `${rec.jenisPenetapan} (${rec.golongan})`;
        }

        // Ekstraksi Rincian Biaya Bagian I / A
        if (inBiayaBebanSection) {
          if (/^1\.\s*(?:Biaya|Beban)/i.test(left)) {
            const mRp = right.match(/Rp\s*([\d.]+)/i);
            if (mRp) rec.biayaBeban = parseRupiah(mRp[1]);
          }
          if (left.startsWith('=') && /\d+\s*x\s*\(/i.test(left) && rec.rumusBeban === '-') {
            rec.rumusBeban = left.replace(/^=\s*/, '').trim();
          }
          if (/^2\.\s*Biaya Pemakaian/i.test(left)) {
            const mKwh = right.match(/kWh\s*([\d.]+)/i);
            if (mKwh) rec.pemakaianKwh = parseRupiah(mKwh[1]);
            if (i + 1 < rows.length) {
              const mRpKwh = rows[i + 1].right.match(/Rp\s*([\d.]+)/i);
              if (mRpKwh) rec.biayaPemakaianKwh = parseRupiah(mRpKwh[1]);
            }
          }
          if (left.includes('kWh x (Rp') || left.includes('kWh x ( Rp')) {
            rec.rumusKwh = left.replace(/^=\s*/, '').trim();
          }
          if (left.includes('Jumlah Biaya Beban / Rekening Minimum dan Biaya Pemakaian kWh')) {
            const mSub = right.match(/Rp\s*([\d.]+)/i);
            if (mSub) rec.subtotalBebanKwh = parseRupiah(mSub[1]);
          }
        }

        // Ekstraksi Rincian Biaya Bagian II / B (Biaya Lain-lain)
        if (inBiayaLainSection) {
          if (/^1\.\s*Biaya Material/i.test(left)) {
            const mMat = right.match(/Rp\s*([\d.]+)/i);
            if (mMat) rec.biayaMaterial = parseRupiah(mMat[1]);
          }
          if (/^2\.\s*Biaya Segel/i.test(left)) {
            const mSeg = right.match(/Rp\s*([\d.]+)/i);
            if (mSeg) rec.biayaSegel = parseRupiah(mSeg[1]);
          }
          if (/^3\.\s*Biaya PBJT-TL\s*\/\s*PPJ/i.test(left)) {
            const mPpj = right.match(/Rp\s*([\d.]+)/i);
            if (mPpj) rec.biayaPPJ = parseRupiah(mPpj[1]);
          }
        }

        // Total Tagihan Susulan
        if (left.includes('Jumlah Penetapan Tagihan Susulan (1+2)') || f.startsWith('Total Rp')) {
          const mTot = (right || f).match(/Rp\s*([\d.]+)/i);
          if (mTot) rec.totalTagihan = parseRupiah(mTot[1]);
        }
      }
    }

    // 3. DOKUMEN SURAT PENGAKUAN HUTANG (SPH)
    if (isSPH) {
      if (!rec.jenisDokumenMasuk.includes('SPH')) {
        rec.jenisDokumenMasuk.push('SPH');
      }
      rec.skemaPembayaran = 'Angsuran (SPH)';
      const angsuranTemp: AngsuranItem[] = [];

      for (let i = 0; i < rows.length; i++) {
        const { full: f } = rows[i];

        const mNoSph = f.match(/Nomor\s*:\s*([^\s,]+)\s*,\s*Tanggal\s*:\s*([\d-]+)/i);
        if (mNoSph && rec.noPenetapan === '-') {
          rec.noPenetapan = mNoSph[1].trim();
          rec.tglPenetapan = mNoSph[2].trim();
        }

        const mGolSph = f.match(/Golongan Penetapan\s*:\s*(P[1-4])/i);
        if (mGolSph && rec.golongan === '-') {
          rec.golongan = mGolSph[1].toUpperCase();
          rec.jenisGolongan = `Pelanggaran (${rec.golongan})`;
        }

        // Backup nilai biaya apabila file Penetapan TS belum dimasukkan
        if (f.includes('a. Biaya Beban dan Biaya Pemakaian kWh') && rec.subtotalBebanKwh === 0) {
          const mSub = f.match(/Rp\s*([\d.]+)/i);
          if (mSub) rec.subtotalBebanKwh = parseRupiah(mSub[1]);
        }
        if (f.includes('b. nilai kWh') && rec.pemakaianKwh === 0) {
          const mKwh = f.match(/:\s*([\d.]+)\s*kWh/i);
          if (mKwh) rec.pemakaianKwh = parseRupiah(mKwh[1]);
        }
        if (f.includes('e. Biaya PBJT-TL / PPJ') && rec.biayaPPJ === 0) {
          const mPpj = f.match(/Rp\s*([\d.]+)/i);
          if (mPpj) rec.biayaPPJ = parseRupiah(mPpj[1]);
        }
        if (f.includes('6. Nilai Total Tagihan Susulan') && rec.totalTagihan === 0) {
          const mTot = f.match(/Rp\s*([\d.]+)/i);
          if (mTot) rec.totalTagihan = parseRupiah(mTot[1]);
        }

        if (f.includes('Terbilang')) {
          let terb = f.split(':').slice(1).join(':').trim();
          if (i + 1 < rows.length && rows[i + 1].full.includes('//')) {
            terb += ' ' + rows[i + 1].full.trim();
          }
          rec.terbilang = terb.replace(/\//g, '').replace(/\s+/g, ' ').trim();
        }

        const mIdSph = f.match(/pada ID Pelanggan\s*(\d{10,14})/i);
        if (mIdSph && rec.idPelPenanggung === '-') {
          rec.idPelPenanggung = mIdSph[1].trim();
        }

        if (f.includes('Uang Muka Angsuran')) {
          const mDp = f.match(/Uang Muka Angsuran\s*:\s*Rp\s*([\d.]+)/i);
          if (mDp) rec.uangMuka = parseRupiah(mDp[1]);

          const mReg = f.match(/No Register\s*:\s*(\d+)/i);
          if (mReg && rec.noRegister === '-') rec.noRegister = mReg[1].trim();
        }

        const mAng = f.match(
          /Angsuran ke-(\d+),\s*rekening bulan\s*([A-Za-z]+\s+\d{4})\s*:\s*Rp\s*([\d.]+)\s*Tgl Jatuh Tempo\s*:\s*(.+)/i
        );
        if (mAng) {
          const ke = parseInt(mAng[1], 10);
          if (!angsuranTemp.some((a) => a.ke === ke)) {
            angsuranTemp.push({
              ke,
              bulan: mAng[2].trim(),
              nominal: parseRupiah(mAng[3]),
              jatuhTempo: mAng[4].trim(),
            });
          }
        }
      }

      if (angsuranTemp.length > 0) {
        angsuranTemp.sort((a, b) => a.ke - b.ke);
        rec.rincianAngsuran = angsuranTemp;
        rec.tenorBulan = angsuranTemp.length;
        rec.nominalCicilan = angsuranTemp[0].nominal;
        rec.nominalCicilanAkhir = angsuranTemp[angsuranTemp.length - 1].nominal;
        rec.periodeAngsuran = `${angsuranTemp.length} Bulan (${angsuranTemp[0].bulan} - ${
          angsuranTemp[angsuranTemp.length - 1].bulan
        })`;
      }
    }

    finalizeAndDiagnose(rec);
    recordMap.set(noAgenda, rec);
  }

  return recordMap;
}