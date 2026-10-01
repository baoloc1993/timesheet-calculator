// Vòng 6 — dùng chung cho S12 (phát từng người) + S13 (in phiếu) — cùng đọc một KetQuaKy,
// cùng công thức giải trình 5 khoản. Hàm thuần ( — logic nghiệp vụ chỉ ở
// src/core/, không nằm trong component renderer — soi bug pha P vòng 6).
import type { KetQuaKy, DongBang } from './ketQuaKy'
import { tinhThucNhanDayDu, chuyenCanCua } from './ketQuaKy'

export interface NguoiPhat {
  d: DongBang
  /** Lý do chặn phát/in — null = không chặn. */
  chan: string | null
  /** false = kỳ lưu TRƯỚC vòng 6, thiếu đơn giá đóng băng → giải trình rút gọn (khác `chan`). */
  coDonGia: boolean
  luongCong: number
  tienOt: number
  tho: number
  /** 3 khoản cộng — 0 khi thiếu field (kỳ cũ), dùng để hiện/ẩn từng dòng giải trình. */
  chuyenCan: number
  buLuong: number
  le: number
  /** 2 khoản trừ. */
  baoHiem: number
  khauTru: number
  thucNhan: number
  daTra: boolean
}

/**
 * Đơn giá đọc từ `dongBang[].donGiaNgay/donGiaGioOT` ĐÃ ĐÓNG BĂNG lúc lưu kỳ — không đọc
 * `NhanVien` hiện tại (có thể đã đổi giá sau khi lưu). Field thiếu hẳn (kỳ lưu trước vòng 6)
 * → không chặn, giải trình rút gọn còn "Thành tiền". Có mặt và cả hai đều 0 → chặn thật.
 */
export function dungNguoiPhat(kq: KetQuaKy, d: DongBang): NguoiPhat {
  const coDonGia = d.donGiaNgay !== undefined && d.donGiaGioOT !== undefined
  const chan = coDonGia && d.donGiaNgay === 0 && d.donGiaGioOT === 0 ? 'chưa khai đơn giá' : null
  const luongCong = (d.donGiaNgay ?? 0) * d.ngayCong
  const tienOt = (d.donGiaGioOT ?? 0) * d.gioOT
  const khauTru = kq.khauTru[d.maNhanVien] ?? 0
  const chuyenCan = chuyenCanCua(kq, d)
  const buLuong = kq.buLuong?.[d.maNhanVien] ?? 0
  const le = kq.le?.[d.maNhanVien] ?? 0
  const baoHiem = kq.baoHiem?.[d.maNhanVien] ?? 0
  return {
    d,
    chan,
    coDonGia,
    luongCong,
    tienOt,
    tho: coDonGia ? luongCong + tienOt : d.thanhTien,
    chuyenCan,
    buLuong,
    le,
    baoHiem,
    khauTru,
    thucNhan: tinhThucNhanDayDu(d.thanhTien, khauTru, { chuyenCan, buLuong, le, baoHiem }),
    daTra: kq.daTra[d.maNhanVien] === true
  }
}

export function dsNguoiPhat(kq: KetQuaKy): NguoiPhat[] {
  return kq.dongBang.map((d) => dungNguoiPhat(kq, d))
}
