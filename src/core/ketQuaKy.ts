// Vòng 3 — lưu kết quả một kỳ + phát lương. Hàm thuần, không phụ thuộc Electron/fs/exceljs.

import type { TongHopNhanVien, KetQuaKyCong, NhanVienThieuSetup, SuaTay } from './types'

/** Một dòng đóng băng khi lưu kỳ — KHÔNG tính lại sau đó. */
export interface DongBang {
  maNhanVien: string
  tenBangLuong: string
  ngayCong: number
  gioOT: number
  thanhTien: number
  soDongDaSua: number
  /**
   * Vòng 6, optional — đơn giá TẠI THỜI ĐIỂM LƯU (đóng băng cùng lúc với thanhTien) để
   * S12/S13 giải trình đúng "ngày công × giá + OT × giá". Kỳ lưu TRƯỚC vòng 6 thiếu field
   * này → giải trình rút gọn còn một dòng "Thành tiền".
   */
  donGiaNgay?: number
  donGiaGioOT?: number
}

/** Map maNhanVien → số VND ≥ 0, sửa được sau khi lưu (khấu trừ/phụ cấp). */
type MapTien = Record<string, number>

/** Một kỳ đã lưu — collection thứ 2 trong config.json, khoá theo `thang` ("2026-09"). */
export interface KetQuaKy {
  thang: string
  ngayLuu: string // ISO
  khoangNgay: { tu: string; den: string }
  /** Đóng băng lúc lưu. */
  dongBang: DongBang[]
  /** Sửa được sau khi lưu — map maNhanVien → số VND ≥ 0. Hiển thị là "Vay" từ vòng 6. */
  khauTru: MapTien
  /** Sửa được sau khi lưu — map maNhanVien → đã trả chưa. */
  daTra: Record<string, boolean>
  /**
   * Vòng 6, optional — 3 khoản CỘNG vào thực nhận (map maNhanVien → số VND ≥ 0).
   * Thiếu field (kỳ lưu trước vòng 6) → đọc như rỗng `{}`, không throw.
   */
  chuyenCan?: MapTien
  buLuong?: MapTien
  le?: MapTien
  /** Vòng 6, optional — khoản TRỪ (cùng chiều `khauTru`). */
  baoHiem?: MapTien
  /**
   * Vòng 8, optional — các chỗ đã sửa tay ở "Giải trình & sửa công" tại thời điểm ghi.
   * Persist để tự động nạp lại (vòng 7 AC-1) tái áp dụng đúng sau khi tắt/mở lại app —
   * trước vòng 8, mảng này chỉ sống trong bộ nhớ tiến trình nên mất khi đóng app.
   */
  suaTay?: SuaTay[]
  /**
   * Vòng 8, optional — nhân viên còn thiếu Setup TẠI THỜI ĐIỂM GHI (không phải lúc xem lại).
   * Khác `0` → "Phát lương kỳ này" bị khoá tới khi khai đủ Setup rồi nạp lại (thay cho việc
   * chặn hẳn không cho lưu như trước vòng 8 — giờ mọi kỳ đều tự lưu, kể cả kỳ thiếu người).
   */
  thieuSetup?: NhanVienThieuSetup[]
  /**
   * Vòng 11 (E) — true = ô Chuyên cần của mã CHƯA nhập tay tự tính từ ngày công
   * (`tinhChuyenCan`). Thiếu field (kỳ lưu trước bản này) → xem `coChuyenCanTuDong`.
   */
  chuyenCanTuDong?: boolean
  /**
   * Mã đã SỬA TAY ô Chuyên cần (bản 0.11.3). Trước đó S10 ghi số 0 mỗi lần bấm qua ô (onBlur),
   * nên `chuyenCan[ma] = 0` không có cờ này = chưa ai gõ → vẫn tự tính.
   */
  chuyenCanSuaTay?: Record<string, boolean>
}

/**
 * Chuyên cần theo ngày công (người dùng chốt qua chat 2026-10-01): dưới 27 công → 0;
 * đủ 27 công → 100.000đ; mỗi nửa công thêm → +50.000đ (28 công = 200.000đ). Phần lẻ dưới
 * nửa công không tính.
 */
export function tinhChuyenCan(ngayCong: number): number {
  if (!Number.isFinite(ngayCong) || ngayCong < 27) return 0
  const nuaCongThem = Math.floor((ngayCong - 27) * 2 + 1e-9)
  return 100000 + nuaCongThem * 50000
}

/**
 * Kỳ có tự tính chuyên cần không. Kỳ lưu trước bản này (thiếu field): chỉ tự tính khi chưa
 * phát cho ai — kỳ đã phát (dù một người) giữ nguyên số cũ, không tự đổi thực nhận lịch sử.
 */
export function coChuyenCanTuDong(kq: Pick<KetQuaKy, 'chuyenCanTuDong' | 'daTra'>): boolean {
  return kq.chuyenCanTuDong ?? !Object.values(kq.daTra).some((v) => v === true)
}

/**
 * Ô Chuyên cần của mã này có phải số gõ tay không (kỳ đang tự tính). Có cờ `chuyenCanSuaTay`
 * → tay. Không cờ: số > 0 lưu từ bản trước = người dùng đã gõ; số 0 không cờ = bản cũ tự ghi
 * khi bấm qua ô, KHÔNG tính là sửa tay.
 */
export function chuyenCanLaSoTay(kq: KetQuaKy, ma: string): boolean {
  if (kq.chuyenCanSuaTay?.[ma] === true) return true
  return (kq.chuyenCan?.[ma] ?? 0) > 0
}

/** Chuyên cần hiệu lực của một người: số gõ tay nếu có, else tự tính (nếu kỳ bật). */
export function chuyenCanCua(kq: KetQuaKy, d: Pick<DongBang, 'maNhanVien' | 'ngayCong'>): number {
  if (!coChuyenCanTuDong(kq)) return kq.chuyenCan?.[d.maNhanVien] ?? 0
  if (chuyenCanLaSoTay(kq, d.maNhanVien)) return kq.chuyenCan?.[d.maNhanVien] ?? 0
  return tinhChuyenCan(d.ngayCong)
}

/** Map chuyên cần hiệu lực cho cả kỳ (xuất bảng lương). */
export function mapChuyenCan(kq: KetQuaKy): Record<string, number> {
  return Object.fromEntries(kq.dongBang.map((d) => [d.maNhanVien, chuyenCanCua(kq, d)]))
}

/** Làm tròn thường đến 1.000đ — chỉ cho số tiền mặt cầm tay. */
export function lamTronNghin(x: number): number {
  return Math.round(x / 1000) * 1000
}

/** Thực nhận = làm tròn nghìn(thành tiền − khấu trừ). Có thể âm (vay > lương). */
export function tinhThucNhan(thanhTien: number, khauTru: number): number {
  return lamTronNghin(thanhTien - (Number.isFinite(khauTru) ? khauTru : 0))
}

/**
 * Vòng 6 — thực nhận đầy đủ 5 khoản: thành tiền + Chuyên cần + Bù lương + Lễ − Bảo hiểm − Vay
 * (`khauTru`), làm tròn nghìn. Field thiếu (kỳ cũ chưa khai) → coi như 0.
 */
export function tinhThucNhanDayDu(
  thanhTien: number,
  khauTru: number,
  phuCap?: { chuyenCan?: number; buLuong?: number; le?: number; baoHiem?: number }
): number {
  const so = (x: number | undefined) => (Number.isFinite(x) ? (x as number) : 0)
  return lamTronNghin(
    thanhTien +
      so(phuCap?.chuyenCan) +
      so(phuCap?.buLuong) +
      so(phuCap?.le) -
      so(phuCap?.baoHiem) -
      (Number.isFinite(khauTru) ? khauTru : 0)
  )
}

/**
 * Chụp `dongBang[]` từ tổng hợp nhân viên hiện tại + thông tin kỳ.
 * `khauTru`/`daTra` để rỗng — bên gọi (IPC `luu-ky`) merge giá trị cũ nếu ghi đè.
 */
export function dongBangKetQuaKy(
  ky: Pick<KetQuaKyCong, 'thang' | 'ngayBatDau' | 'ngayKetThuc'>,
  tongHop: TongHopNhanVien[],
  ngayLuu: string
): KetQuaKy {
  return {
    thang: ky.thang,
    ngayLuu,
    khoangNgay: { tu: ky.ngayBatDau, den: ky.ngayKetThuc },
    dongBang: tongHop.map((t) => ({
      maNhanVien: t.maNhanVien,
      tenBangLuong: t.tenBangLuong || t.tenMay,
      ngayCong: t.tongNgayCong,
      gioOT: t.tongGioOT,
      thanhTien: t.thanhTien,
      soDongDaSua: t.soDongCanXemLai,
      donGiaNgay: t.donGiaNgay,
      donGiaGioOT: t.donGiaGioOT
    })),
    khauTru: {},
    daTra: {},
    chuyenCan: {},
    buLuong: {},
    le: {},
    baoHiem: {},
    chuyenCanTuDong: true
  }
}

/**
 * Ghi đè một kỳ đã lưu: giữ `khauTru` / `daTra` cũ cho mã CÒN trong kỳ mới, bỏ mã đã biến mất,
 * mã mới nhận mặc định (0 / chưa trả). Trả về `kqMoi` đã merge (mutate tại chỗ + trả luôn).
 */
export function mergePhatLuongCu(kqMoi: KetQuaKy, kqCu: KetQuaKy | null | undefined): KetQuaKy {
  if (!kqCu) return kqMoi
  kqMoi.chuyenCanTuDong = coChuyenCanTuDong(kqCu)
  const maTrongKyMoi = new Set(kqMoi.dongBang.map((d) => d.maNhanVien))
  for (const [ma, v] of Object.entries(kqCu.chuyenCanSuaTay ?? {})) {
    if (v && maTrongKyMoi.has(ma)) kqMoi.chuyenCanSuaTay = { ...(kqMoi.chuyenCanSuaTay ?? {}), [ma]: true }
  }
  for (const [ma, v] of Object.entries(kqCu.khauTru)) {
    if (maTrongKyMoi.has(ma)) kqMoi.khauTru[ma] = v
  }
  for (const [ma, v] of Object.entries(kqCu.daTra)) {
    if (maTrongKyMoi.has(ma)) kqMoi.daTra[ma] = v
  }
  // Vòng 6 — 4 khoản mới giữ cùng cơ chế khauTru/daTra (kỳ cũ chưa vòng 6 thì thiếu field, bỏ qua).
  for (const truong of ['chuyenCan', 'buLuong', 'le', 'baoHiem'] as const) {
    const cu = kqCu[truong]
    if (!cu) continue
    for (const [ma, v] of Object.entries(cu)) {
      if (maTrongKyMoi.has(ma)) kqMoi[truong]![ma] = v
    }
  }
  return kqMoi
}

/** Σ của một kỳ đã lưu — từ dongBang (đóng băng), KHÔNG chạm NhanVien. */
export function tongKetQuaKy(kq: KetQuaKy): {
  tongNgayCong: number
  tongGioOT: number
  tongThanhTien: number
  tongThucNhan: number
  soNguoiChuaNhan: number
} {
  const lam2 = (x: number) => Math.round(x * 100) / 100
  let tongNgayCong = 0
  let tongGioOT = 0
  let tongThanhTien = 0
  let tongThucNhan = 0
  let soNguoiChuaNhan = 0
  for (const d of kq.dongBang) {
    tongNgayCong += d.ngayCong
    tongGioOT += d.gioOT
    tongThanhTien += d.thanhTien
    tongThucNhan += tinhThucNhanDayDu(d.thanhTien, kq.khauTru[d.maNhanVien] ?? 0, {
      chuyenCan: chuyenCanCua(kq, d),
      buLuong: kq.buLuong?.[d.maNhanVien],
      le: kq.le?.[d.maNhanVien],
      baoHiem: kq.baoHiem?.[d.maNhanVien]
    })
    if (kq.daTra[d.maNhanVien] !== true) soNguoiChuaNhan++
  }
  return {
    tongNgayCong: lam2(tongNgayCong),
    tongGioOT: lam2(tongGioOT),
    tongThanhTien,
    tongThucNhan,
    soNguoiChuaNhan
  }
}
