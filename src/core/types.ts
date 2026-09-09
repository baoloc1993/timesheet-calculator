// Kiểu dữ liệu lõi — hàm thuần, không phụ thuộc Electron/fs/exceljs.

/** Một nhân viên khai trong Setup (bền, electron-store). */
export interface NhanVien {
  id: string
  maNhanVien: string
  tenMay: string
  tenBangLuong: string
  nguongGioChuanNgay: number
  donGiaNgay: number
  donGiaGioOT: number
  an: boolean
}

/** Một dòng ngày đọc thô từ file máy (đã parse, chưa tính). */
export interface DongNgayMay {
  ngay: string // ISO "2026-08-01"
  thu: string
  /** 6 mốc theo cột C,D,E,F,G,H: [vao1, ra1, vao2, ra2, vao3, ra3]. "HH:MM" hoặc null. */
  moc: (string | null)[]
  congMay: number | null
  otMay: number | null
}

/** Một khối nhân viên trong file máy. */
export interface KhoiFileMay {
  maNhanVien: string
  tenMay: string
  dongNgay: DongNgayMay[]
}

/** Kết quả parse toàn file máy. */
export interface FileMayDaDoc {
  thang: string // "2026-08"
  ngayBatDau: string
  ngayKetThuc: string
  khoi: KhoiFileMay[]
}

export type MucDoCanhBao = 'none' | 'vang'

/** Kết quả tính cho một ngày của một nhân viên. */
export interface KetQuaNgay {
  ngay: string
  thu: string
  /** Cặp vào/ra sau khi sửa (tối đa 3). */
  capVaoRa: { vao: string | null; ra: string | null }[]
  /** 6 mốc máy gốc — để đối chiếu lúc xuất, biết ô nào công cụ đã đụng. */
  nguonGoc: (string | null)[]
  gioLamQ: number
  ngayCongR: number
  gioOtS: number
  daSua: boolean
  /**
   * Dòng bị ép OT = 0 vì thiếu/lộn mốc. Cờ này BÁM theo dòng —
   * chỉ gỡ khi người dùng sửa tay để đủ 4 mốc thật. Thay cho
   * việc suy từ chuỗi ghiChuSua.
   */
  otBiEp: boolean
  ghiChuSua: string
  mucDoCanhBao: MucDoCanhBao
}

/** Tổng hợp một nhân viên trong kỳ. */
export interface TongHopNhanVien {
  maNhanVien: string
  tenMay: string
  tenBangLuong: string
  nguongGioChuanNgay: number
  donGiaNgay: number
  donGiaGioOT: number
  tongNgayCong: number
  tongGioOT: number
  soDongCanXemLai: number
  /** Dẫn xuất (vòng 2): Σ ngày công × đơn giá ngày + Σ giờ OT × đơn giá giờ OT. Chỉ hiển thị S7. */
  thanhTien: number
  ketQuaNgay: KetQuaNgay[]
}

export interface NhanVienThieuSetup {
  maNhanVien: string
  tenMay: string
}

/**
 * Một chỗ người dùng sửa tay công của một ngày (vòng 8 — persist để ghi nhớ qua tự động
 * nạp lại / tắt-mở app, thay vì chỉ giữ trong bộ nhớ tiến trình như trước).
 *
 * Vòng 9 — union hai loại sửa: `gio` (sửa mốc vào/ra, có từ vòng 8) và `ngayCong` (sửa
 * thẳng "Ngày công" 0/0.5/1, không đụng giờ). Bản ghi TRÊN ĐĨA từ trước vòng 9 không có
 * `loai` — đọc như `gio` tại chỗ dùng (`apDungSuaTay`), không migrate dữ liệu.
 */
export type SuaTay =
  | { loai: 'gio'; maNhanVien: string; ngay: string; cap: { vao: string | null; ra: string | null }[] }
  | { loai: 'ngayCong'; maNhanVien: string; ngay: string; r: 0 | 0.5 | 1 }

/** Kết quả xử lý cả kỳ. */
export interface KetQuaKyCong {
  thang: string
  ngayBatDau: string
  ngayKetThuc: string
  thieuSetup: NhanVienThieuSetup[]
  tongHop: TongHopNhanVien[]
  tongNgayCongCaKy: number
  tongGioOTCaKy: number
  tongDongCanXemLai: number
  /** Dẫn xuất (vòng 2): Σ thành tiền mọi nhân viên trong kỳ. */
  tongThanhTienCaKy: number
}
