// Vòng 3 — lưu kết quả một kỳ + phát lương. Hàm thuần, không phụ thuộc Electron/fs/exceljs.

import type { TongHopNhanVien, KetQuaKyCong } from './types'

/** Một dòng đóng băng khi lưu kỳ — KHÔNG tính lại sau đó. */
export interface DongBang {
  maNhanVien: string
  tenBangLuong: string
  ngayCong: number
  gioOT: number
  thanhTien: number
  soDongDaSua: number
}

/** Một kỳ đã lưu — collection thứ 2 trong config.json, khoá theo `thang` ("2026-09"). */
export interface KetQuaKy {
  thang: string
  ngayLuu: string // ISO
  khoangNgay: { tu: string; den: string }
  /** Đóng băng lúc lưu. */
  dongBang: DongBang[]
  /** Sửa được sau khi lưu — map maNhanVien → số VND ≥ 0. */
  khauTru: Record<string, number>
  /** Sửa được sau khi lưu — map maNhanVien → đã trả chưa. */
  daTra: Record<string, boolean>
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
      soDongDaSua: t.soDongCanXemLai
    })),
    khauTru: {},
    daTra: {}
  }
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
    tongThucNhan += tinhThucNhan(d.thanhTien, kq.khauTru[d.maNhanVien] ?? 0)
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
