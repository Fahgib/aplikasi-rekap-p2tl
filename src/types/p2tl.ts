export interface AngsuranItem {
  ke: number;
  bulan: string;
  nominal: number;
  jatuhTempo: string;
}

export interface P2TLRecord {
  // 1. Data Administrasi & Unit
  noAgenda: string;
  up3: string;
  ulp: string;
  noBA: string;
  tglBA: string;
  noPenetapan: string;
  tglPenetapan: string;
  noRegister: string;

  // 2. Data Pelanggan & Penandatangan KTP
  idPelangganTemuan: string;
  namaPelanggan: string;
  alamatTemuan: string;
  tarifDaya: string;
  namaKTP: string;
  noKTP: string;
  alamatKTP: string;

  // 3. Rincian Biaya, kWh & Dasar Perhitungan
  jenisPenetapan: string;
  golongan: string;
  jenisGolongan: string;
  rumusBeban: string;
  rumusKwh: string;
  pemakaianKwh: number;
  biayaBeban: number;
  biayaPemakaianKwh: number;
  subtotalBebanKwh: number;
  biayaMaterial: number;
  biayaSegel: number;
  biayaPPJ: number;
  biayaLainnya: number;
  totalTagihan: number;
  terbilang: string;

  // 4. Data Angsuran (SPH) & IDPEL Penanggung Hutang
  skemaPembayaran: 'Angsuran (SPH)' | 'Langsung / Non-Angsuran';
  idPelPenanggung: string;
  namaPenanggung: string;
  alamatPenanggung: string;
  tarifDayaPenanggung: string;
  uangMuka: number;
  sisaHutang: number;
  tenorBulan: number;
  nominalCicilan: number;
  nominalCicilanAkhir: number;
  periodeAngsuran: string;
  rincianAngsuran: AngsuranItem[];

  // 5. Otorisasi & Analisis Otomatis Web
  manager: string;
  petugasCetak: string;
  jenisDokumenMasuk: string[];
  namaFileMasuk: string[];
  statusKelengkapan: string;
  diagnosaMasalah: string;
  rekomendasiSolusi: string;
}