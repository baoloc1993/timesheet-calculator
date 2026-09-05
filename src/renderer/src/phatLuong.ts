// Dùng chung cho S12 (phát từng người) + S13 (in phiếu) — cùng đọc một KetQuaKy, cùng
// công thức giải trình 5 khoản. Nguồn: (vòng 6, ca biên S12/S13).
import type { KetQuaKy, DongBang } from '../../preload/api-types'
import { tinhThucNhanDayDu } from '../../preload/api-types'

export interface NguoiPhat {
  d: DongBang
  /** Lý do chặn phát/in — null = không chặn. */
  chan: string | null
  /** false = kỳ lưu TRƯỚC vòng 6, thiếu đơn giá đóng băng → giải trình rút gọn (khác `chan`). */
  coDonGia: boolean
  luongCong: number
  tienOt: number
  tho: number
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
  const phuCap = {
    chuyenCan: kq.chuyenCan?.[d.maNhanVien],
    buLuong: kq.buLuong?.[d.maNhanVien],
    le: kq.le?.[d.maNhanVien],
    baoHiem: kq.baoHiem?.[d.maNhanVien]
  }
  return {
    d,
    chan,
    coDonGia,
    luongCong,
    tienOt,
    tho: coDonGia ? luongCong + tienOt : d.thanhTien,
    khauTru,
    thucNhan: tinhThucNhanDayDu(d.thanhTien, khauTru, phuCap),
    daTra: kq.daTra[d.maNhanVien] === true
  }
}

export function dsNguoiPhat(kq: KetQuaKy): NguoiPhat[] {
  return kq.dongBang.map((d) => dungNguoiPhat(kq, d))
}
