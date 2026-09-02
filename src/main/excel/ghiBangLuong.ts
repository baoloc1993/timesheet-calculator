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

const FONT = 'Segoe UI'
const XANH = 'FF004E92' // --color-primary
const NHAT = 'FFEEF3FA' // nền phụ nhạt
const VIEN = 'FFBFBFBF'
/** Thẻ chiếm 11 dòng (base..base+10); band = 12 dòng (thêm 1 dòng đệm giữa các hàng thẻ). */
export const CAO_THE = 11
export const CAO_BAND = 12

function vienO(): import('exceljs').Borders {
  const s = { style: 'thin' as const, color: { argb: VIEN } }
  return { top: s, left: s, bottom: s, right: s } as import('exceljs').Borders
}

/**
 * Dựng MỘT thẻ nhân viên theo khuôn cố định vào cụm cột `cum`, bắt đầu ở dòng `base`.
 * Lưới đều — mọi thẻ giống hệt nhau: header tên → 2 dòng số (Lương tháng / Làm thêm) →
 * dòng cộng kỳ → 5 khoản nhập tay (để trống) → Tổng. Có viền quanh cả thẻ.
 * Trả vị trí ô để `dienThe` ghi số.
 */
function themThe(
  ws: import('exceljs').Worksheet,
  base: number,
  cum: Cum,
  the: { tenBangLuong: string; donGiaNgay: number; donGiaGioOT: number },
  kyLabel: string
): TheNhanVienBangLuong {
  const cols = [cum.ten, cum.dvt, cum.sl, cum.dg, cum.tt]
  const set = (col: string, r: number, v: import('exceljs').CellValue): import('exceljs').Cell => {
    const c = ws.getCell(`${col}${r}`)
    c.value = v
    c.font = { name: FONT, size: 11, color: { argb: 'FF1A1A1A' } }
    c.border = vienO()
    return c
  }
  // Ô trống trong khối vẫn cần viền để thẻ liền mạch.
  for (let r = base; r < base + CAO_THE; r++) for (const col of cols) set(col, r, null)

  // base+0: header tên — nền xanh, chữ trắng, trải cả cụm.
  ws.mergeCells(`${cum.ten}${base}:${cum.tt}${base}`)
  const h = ws.getCell(`${cum.ten}${base}`)
  h.value = `Tên: ${the.tenBangLuong}`
  h.font = { name: FONT, size: 11.5, bold: true, color: { argb: 'FFFFFFFF' } }
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XANH } }
  h.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // base+1: nhãn cột.
  for (const [i, nhan] of ['', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền'].entries()) {
    const c = set(cols[i], base + 1, nhan)
    c.font = { name: FONT, size: 9.5, bold: true, italic: true, color: { argb: 'FF4B4B50' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NHAT } }
    c.alignment = { horizontal: i === 0 ? 'left' : 'center' }
  }

  const rNgay = base + 2
  const rGio = base + 3
  const rKy = base + 4
  const so = (c: import('exceljs').Cell) => {
    c.numFmt = '#,##0.##'
    c.alignment = { horizontal: 'right' }
    return c
  }
  const tien = (c: import('exceljs').Cell) => {
    c.numFmt = '#,##0'
    c.alignment = { horizontal: 'right' }
    return c
  }

  set(cum.ten, rNgay, 'Lương tháng:').font = { name: FONT, size: 11, bold: true }
  set(cum.dvt, rNgay, 'ngày').alignment = { horizontal: 'center' }
  so(set(cum.sl, rNgay, 0))
  tien(set(cum.dg, rNgay, the.donGiaNgay || 0))
  tien(set(cum.tt, rNgay, { formula: `${cum.dg}${rNgay}*${cum.sl}${rNgay}` }))

  set(cum.ten, rGio, 'Làm thêm').font = { name: FONT, size: 11, bold: true }
  set(cum.dvt, rGio, 'giờ').alignment = { horizontal: 'center' }
  so(set(cum.sl, rGio, 0))
  tien(set(cum.dg, rGio, the.donGiaGioOT || 0))
  tien(set(cum.tt, rGio, { formula: `${cum.dg}${rGio}*${cum.sl}${rGio}` }))

  const oKy = set(cum.ten, rKy, kyLabel || 'kỳ')
  oKy.font = { name: FONT, size: 9.5, italic: true, color: { argb: 'FF4B4B50' } }
  tien(set(cum.tt, rKy, { formula: `SUM(${cum.tt}${rNgay}:${cum.tt}${rGio})` }))

  const khoan = ['Chuyên cần', 'bu lương', 'Lễ', 'bảo hiểm', 'vay']
  khoan.forEach((nhan, i) => {
    set(cum.ten, base + 5 + i, nhan)
    tien(set(cum.tt, base + 5 + i, null))
  })

  const rTong = base + 10
  for (const col of cols) {
    const c = set(col, rTong, null)
    c.font = { name: FONT, size: 11, bold: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NHAT } }
  }
  ws.getCell(`${cum.ten}${rTong}`).value = 'Tổng'
  tien(
    set(cum.tt, rTong, {
      formula:
        `${cum.tt}${rKy}+${cum.tt}${base + 5}+${cum.tt}${base + 6}+${cum.tt}${base + 7}` +
        `-${cum.tt}${base + 8}-${cum.tt}${base + 9}`
    })
  ).font = { name: FONT, size: 11, bold: true }

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

  // Ô "Kỳ:" ở đầu bảng (khuôn trống có sẵn A2) + mọi ô nhãn kỳ cũ trong file.
  if (kyLabel) {
    ws.getCell('A2').value = `Kỳ: ${kyLabel}`
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

  // Dựng thẻ cho nhân viên chưa có sẵn trong mẫu (khuôn trống → mọi người; mẫu có thẻ →
  // chỉ người mới). Lưới đều: 2 thẻ / hàng, band cố định, cột trái/phải thẳng nhau.
  if (chuaCoThe.length) {
    const coTheSan = dongCuoiCoNoiDung(ws)
    const start = coTheSan <= 2 ? 4 : coTheSan + 2 // khuôn trống: ngay dưới tiêu đề
    chuaCoThe.forEach((th, i) => {
      const base = start + Math.floor(i / 2) * CAO_BAND
      const cum = i % 2 === 0 ? CUM_TRAI : CUM_PHAI
      try {
        const the = themThe(ws, base, cum, th, kyLabel)
        dienThe(the, th)
        daGhi.push(th.maNhanVien)
        theThemMoi.push(th.tenBangLuong || th.tenMay || th.maNhanVien)
        for (let r = base; r < base + CAO_THE; r++) ws.getRow(r).height = r === base ? 19 : 16
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
