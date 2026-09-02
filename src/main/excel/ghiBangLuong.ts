// Ghi file *bảng lương* — chép khuôn mẫu (vòng 3: nhúng sẵn `resources/mau-bang-luong.xlsx`),
// ghi đè Số lượng ngày / Số lượng giờ OT / Đơn giá. Nhân viên trong kỳ chưa có thẻ → thêm
// thẻ mới theo khuôn thẻ chuẩn.
// Nguồn: AC-5 + BACKWARD-COMPATIBILITY §1f (bộ ô KHÔNG đổi).

import { existsSync } from 'fs'
import type { TongHopNhanVien } from '../../core/types'
import { docBangLuong, chuanHoaMa } from './docBangLuong'
import type { TheNhanVienBangLuong } from './docBangLuong'
import { LoiDocFileMay } from './docFileMay'
import { ghiFileAtomic } from './ghiAtomic'
import { log } from '../logger'

export interface KetQuaGhiBangLuong {
  duongDanRa: string
  daGhi: string[] // maNhanVien đã điền
  khongKhop: string[] // tên nhân viên không điền được (không nên xảy ra ở vòng 3)
  theGiuSoCu: string[] // thẻ trong mẫu KHÔNG được cập nhật kỳ này (giữ số kỳ trước — BH-8)
  theThemMoi: string[] // tên thẻ vừa thêm vì mẫu chưa có (vòng 3 — AC-5)
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

// ---- Thêm thẻ mới theo khuôn thẻ chuẩn (2 cột A-E / G-K, giống mẫu công ty) ----

interface Cum {
  ten: string
  dvt: string
  sl: string
  dg: string
  tt: string
}
const CUM_TRAI: Cum = { ten: 'A', dvt: 'B', sl: 'C', dg: 'D', tt: 'E' }
const CUM_PHAI: Cum = { ten: 'G', dvt: 'H', sl: 'I', dg: 'J', tt: 'K' }

function styleTen(cell: import('exceljs').Cell): void {
  cell.font = { name: 'Segoe UI', size: 12.5, bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004E92' } }
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
}

/** Ghi một thẻ nhân viên mới vào cụm cột `cum` bắt đầu ở dòng `base`. Trả vị trí ô để điền. */
function themThe(
  ws: import('exceljs').Worksheet,
  base: number,
  cum: Cum,
  the: { tenBangLuong: string; donGiaNgay: number; donGiaGioOT: number },
  kyLabel: string
): TheNhanVienBangLuong {
  const set = (col: string, r: number, v: import('exceljs').CellValue): import('exceljs').Cell => {
    const c = ws.getCell(`${col}${r}`)
    c.value = v
    c.font = { name: 'Segoe UI', size: 11, color: { argb: 'FF1A1A1A' } }
    return c
  }
  styleTen(set(cum.ten, base, 'Tên:'))
  const oTenPhu = set(cum.dvt, base, the.tenBangLuong)
  oTenPhu.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1A1A1A' } }

  for (const [i, nhan] of ['ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền'].entries()) {
    const c = set([cum.dvt, cum.sl, cum.dg, cum.tt][i], base + 2, nhan)
    c.font = { name: 'Segoe UI', size: 10, bold: true, italic: true, color: { argb: 'FF4B4B50' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F5' } }
    c.alignment = { horizontal: 'center' }
  }

  const rNgay = base + 3
  const rGio = base + 4
  set(cum.ten, rNgay, 'Lương tháng:').font = { name: 'Segoe UI', size: 11, bold: true }
  set(cum.dvt, rNgay, 'ngày')
  set(cum.sl, rNgay, 0).numFmt = '0.##'
  set(cum.dg, rNgay, the.donGiaNgay || 0).numFmt = '#,##0'
  set(cum.tt, rNgay, { formula: `${cum.dg}${rNgay}*${cum.sl}${rNgay}` }).numFmt = '#,##0'

  set(cum.ten, rGio, 'Làm thêm').font = { name: 'Segoe UI', size: 11, bold: true }
  set(cum.dvt, rGio, 'giờ')
  set(cum.sl, rGio, 0).numFmt = '0.##'
  set(cum.dg, rGio, the.donGiaGioOT || 0).numFmt = '#,##0'
  set(cum.tt, rGio, { formula: `${cum.dg}${rGio}*${cum.sl}${rGio}` }).numFmt = '#,##0'

  const rKy = base + 5
  set(cum.ten, rKy, kyLabel).font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF4B4B50' } }
  set(cum.tt, rKy, { formula: `SUM(${cum.tt}${rNgay}:${cum.tt}${rGio})` }).numFmt = '#,##0'

  set(cum.ten, base + 6, 'Chuyên cần')
  set(cum.ten, base + 7, 'bu lương')
  set(cum.ten, base + 8, 'Lễ')
  set(cum.ten, base + 10, 'bảo hiểm')
  set(cum.ten, base + 11, 'vay')
  const rTong = base + 12
  const oTong = set(cum.ten, rTong, 'Tổng')
  oTong.font = { name: 'Segoe UI', size: 11, bold: true }
  oTong.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F1FB' } }
  set(cum.tt, rTong, {
    formula: `${cum.tt}${rKy}+${cum.tt}${base + 6}+${cum.tt}${base + 7}+${cum.tt}${base + 8}-${cum.tt}${base + 10}-${cum.tt}${base + 11}`
  }).numFmt = '#,##0'

  return {
    maNhanVien: '',
    tenBangLuong: the.tenBangLuong,
    donGiaNgay: the.donGiaNgay || 0,
    donGiaGioOT: the.donGiaGioOT || 0,
    oSoLuongNgay: `${cum.sl}${rNgay}`,
    oSoLuongGio: `${cum.sl}${rGio}`,
    oDonGiaNgay: `${cum.dg}${rNgay}`,
    oDonGiaGio: `${cum.dg}${rGio}`
  }
}

function dongCuoiCoNoiDung(ws: import('exceljs').Worksheet): number {
  let max = 1
  const tong = Math.min(ws.rowCount, 5000)
  for (let r = 1; r <= tong; r++) {
    let coO = false
    ws.getRow(r).eachCell({ includeEmpty: false }, (c) => {
      if (c.value != null && c.value !== '') coO = true
    })
    if (coO) max = r
  }
  return max
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

  const kyLabel = ky ? chuoiKy(ky.ngayBatDau, ky.ngayKetThuc) : ''

  // Cập nhật ô nhãn kỳ ("01/07-31/07/2026" → kỳ hiện tại) ở mọi thẻ.
  if (kyLabel) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === 'string' && /^\s*\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/.test(cell.value)) {
          cell.value = kyLabel
        }
      })
    })
  }

  const theTheoMa = new Map(doc.the.filter((t) => t.maNhanVien).map((t) => [t.maNhanVien, t]))
  const theTheoTen = new Map(doc.the.map((t) => [bo(t.tenBangLuong), t]))

  const daGhi: string[] = []
  const theThemMoi: string[] = []
  const khongKhop: string[] = []
  const theDaDung = new Set<TheNhanVienBangLuong>()
  const chuaCoThe: TongHopNhanVien[] = []

  const dienThe = (the: TheNhanVienBangLuong, th: TongHopNhanVien): void => {
    if (the.oSoLuongNgay) ws.getCell(the.oSoLuongNgay).value = th.tongNgayCong
    if (the.oSoLuongGio) ws.getCell(the.oSoLuongGio).value = th.tongGioOT
    if (the.oDonGiaNgay && th.donGiaNgay) ws.getCell(the.oDonGiaNgay).value = th.donGiaNgay
    if (the.oDonGiaGio && th.donGiaGioOT) ws.getCell(the.oDonGiaGio).value = th.donGiaGioOT
  }

  for (const th of tongHop) {
    const the =
      theTheoMa.get(chuanHoaMa(th.maNhanVien)) ||
      theTheoTen.get(bo(th.tenBangLuong)) ||
      theTheoTen.get(bo(th.tenMay))
    if (!the) {
      chuaCoThe.push(th)
      continue
    }
    theDaDung.add(the)
    dienThe(the, th)
    daGhi.push(th.maNhanVien)
  }

  // Thêm thẻ cho nhân viên trong kỳ mà mẫu chưa có (AC-5). Xếp 2 thẻ / khối dòng.
  if (chuaCoThe.length) {
    const start = dongCuoiCoNoiDung(ws) + 3
    chuaCoThe.forEach((th, i) => {
      const base = start + Math.floor(i / 2) * 15
      const cum = i % 2 === 0 ? CUM_TRAI : CUM_PHAI
      try {
        const the = themThe(ws, base, cum, th, kyLabel || '01/01-31/01/2026')
        dienThe(the, th)
        daGhi.push(th.maNhanVien)
        theThemMoi.push(th.tenBangLuong || th.tenMay || th.maNhanVien)
      } catch (e) {
        log.error('thêm thẻ bảng lương', th.maNhanVien, (e as Error).message)
        khongKhop.push(th.tenBangLuong || th.tenMay || th.maNhanVien)
      }
    })
  }

  // Thẻ trong mẫu không được cập nhật kỳ này → còn giữ số lượng ngày/giờ kỳ trước.
  const theGiuSoCu = doc.the
    .filter((t) => !theDaDung.has(t) && (t.oSoLuongNgay || t.oSoLuongGio))
    .map((t) => t.tenBangLuong || t.maNhanVien)

  await ghiFileAtomic(wb, duongDanRa)

  return { duongDanRa, daGhi, khongKhop, theGiuSoCu, theThemMoi }
}
