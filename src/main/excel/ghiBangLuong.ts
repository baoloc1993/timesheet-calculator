// Ghi file *bảng lương* — chép khuôn file kỳ trước, ghi đè số lượng + đơn giá.

import { existsSync } from 'fs'
import type { TongHopNhanVien } from '../../core/types'
import { docBangLuong, chuanHoaMa } from './docBangLuong'
import type { TheNhanVienBangLuong } from './docBangLuong'
import { LoiDocFileMay } from './docFileMay'
import { ghiFileAtomic } from './ghiAtomic'

export interface KetQuaGhiBangLuong {
  duongDanRa: string
  daGhi: string[] // maNhanVien đã điền
  khongKhop: string[] // tenBangLuong trong tổng hợp không tìm thấy thẻ
  theGiuSoCu: string[] // thẻ trong file mẫu KHÔNG được cập nhật kỳ này (giữ số kỳ trước — BH-8)
}

const bo = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

function chuoiKy(ngayBatDau: string, ngayKetThuc: string): string {
  const dm = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? `${m[3]}/${m[2]}` : iso
  }
  const nam = ngayKetThuc.slice(0, 4)
  return `${dm(ngayBatDau)}-${dm(ngayKetThuc)}/${nam}`
}

export async function ghiBangLuong(
  fileMau: string,
  duongDanRa: string,
  tongHop: TongHopNhanVien[],
  ky?: { ngayBatDau: string; ngayKetThuc: string }
): Promise<KetQuaGhiBangLuong> {
  if (!existsSync(fileMau)) {
    throw new LoiDocFileMay('FILE_HONG', 'Không tìm thấy file mẫu bảng lương.')
  }
  const { wb, doc } = await docBangLuong(fileMau)
  const ws = wb.worksheets[0]

  // Cập nhật ô nhãn kỳ ("01/07-31/07/2026" → kỳ hiện tại) ở mọi thẻ.
  if (ky) {
    const kyMoi = chuoiKy(ky.ngayBatDau, ky.ngayKetThuc)
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === 'string' && /^\s*\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/.test(cell.value)) {
          cell.value = kyMoi
        }
      })
    })
  }

  const theTheoMa = new Map(doc.the.filter((t) => t.maNhanVien).map((t) => [t.maNhanVien, t]))
  const theTheoTen = new Map(doc.the.map((t) => [bo(t.tenBangLuong), t]))

  const daGhi: string[] = []
  const khongKhop: string[] = []
  const theDaDung = new Set<TheNhanVienBangLuong>()

  for (const th of tongHop) {
    const the =
      theTheoMa.get(chuanHoaMa(th.maNhanVien)) ||
      theTheoTen.get(bo(th.tenBangLuong)) ||
      theTheoTen.get(bo(th.tenMay))
    if (!the) {
      khongKhop.push(th.tenBangLuong || th.tenMay || th.maNhanVien)
      continue
    }
    theDaDung.add(the)
    if (the.oSoLuongNgay) ws.getCell(the.oSoLuongNgay).value = th.tongNgayCong
    if (the.oSoLuongGio) ws.getCell(the.oSoLuongGio).value = th.tongGioOT
    if (the.oDonGiaNgay && th.donGiaNgay) ws.getCell(the.oDonGiaNgay).value = th.donGiaNgay
    if (the.oDonGiaGio && th.donGiaGioOT) ws.getCell(the.oDonGiaGio).value = th.donGiaGioOT
    daGhi.push(th.maNhanVien)
  }

  // Thẻ trong file mẫu không được cập nhật kỳ này → còn giữ số lượng ngày/giờ kỳ trước.
  // Không tự xoá (có thể là nhân viên người dùng cố ý giữ) — chỉ liệt kê để người dùng xử (BH-8).
  const theGiuSoCu = doc.the
    .filter((t) => !theDaDung.has(t) && (t.oSoLuongNgay || t.oSoLuongGio))
    .map((t) => t.tenBangLuong || t.maNhanVien)

  await ghiFileAtomic(wb, duongDanRa)

  return { duongDanRa, daGhi, khongKhop, theGiuSoCu }
}
