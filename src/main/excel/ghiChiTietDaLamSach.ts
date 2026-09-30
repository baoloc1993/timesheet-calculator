// Ghi file *chi tiết công đã làm sạch* — chép file máy, ghi giá trị Q/R/S tĩnh do
// công cụ tính, ghi đè mốc Vào/Ra đã sửa, tô nền vàng ô công cụ đã đụng.

import ExcelJS from 'exceljs'
import type { TongHopNhanVien, KetQuaNgay } from '../../core/types'
import { LoiDocFileMay } from './docFileMay'
import { phutTrongNgay } from '../../core/time'
import { chuanHoaMa } from '../../core/ma'
import { ghiFileAtomic } from './ghiAtomic'
import { ghiChuNgay } from '../../core/ghiChuNgay'

// Fresh object mỗi lần — exceljs chia sẻ style theo tham chiếu, dùng chung 1 const
// làm nền vàng lan sang cả hàng (cells cùng xf). Nguồn: dogfood 2026-09-01.
const vang = (): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF4CE' } // --color-warning-soft (khoá, tổ hợp sáng/thường)
})

/** Gán fill cho MỘT ô mà không đụng style chung của hàng. */
function toVang(cell: ExcelJS.Cell): void {
  cell.style = { ...cell.style, fill: vang() }
}

const RE_HEADER = /Mã nhân viên:\s*(\S+)\s+Tên nhân viên:/

// ---- Vòng 11 — sheet "Tổng hợp" + mỗi nhân viên một sheet (phương án C) ----
// Màu lấy cố định từ token sáng/thường (DESIGN-SYSTEM.md C21) — Excel không có nền tối.
const MAU_NHAN = 'FFF3F2F1' // --color-bg
const MAU_TIEU_DE = 'FF2564CF' // --color-primary
const MAU_MO = 'FF6B6966' // --color-text-faint
const TEN_TONG_HOP = 'Tổng hợp'
const TEN_KHUON_MAY = 'Chi Tiet'

const nen = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const dmy = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const so2 = (n: number): number => Math.round(n * 100) / 100

/** Tên sheet hợp lệ Excel (bỏ ký tự cấm, ≤31 ký tự), không trùng tên đã dùng. */
function tenSheet(goc: string, daDung: Set<string>): string {
  const sach = (goc.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Nhân viên').slice(0, 31)
  let ten = sach
  for (let i = 2; daDung.has(ten.toLowerCase()); i++) {
    const hau = ` (${i})`
    ten = sach.slice(0, 31 - hau.length) + hau
  }
  daDung.add(ten.toLowerCase())
  return ten
}

function dongNhan(ws: ExcelJS.Worksheet, r: number, nhan: string[]): void {
  const row = ws.getRow(r)
  nhan.forEach((t, i) => {
    const c = row.getCell(i + 1)
    c.value = t
    c.font = { bold: true }
    c.fill = nen(MAU_NHAN)
    c.alignment = { vertical: 'middle', wrapText: true }
  })
  row.commit()
}

function dongTieuDe(ws: ExcelJS.Worksheet, tieuDe: string, phu: string): void {
  ws.getCell(1, 1).value = tieuDe
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: MAU_TIEU_DE } }
  ws.getCell(2, 1).value = phu
}

/**
 * Thêm sheet "Tổng hợp" (đầu) + mỗi nhân viên một sheet; sheet khuôn máy dời cuối, KHÔNG đổi
 * nội dung (`docFileMay` đọc lại theo tên "Chi Tiet"). Chỉ công/OT — không tiền (người dùng chốt
 * 2026-09-30). Số lấy nguyên từ `KetQuaNgay` đã tính → khớp màn S7/S8.
 */
function themSheetDeDoc(wb: ExcelJS.Workbook, khuonMay: ExcelJS.Worksheet, tongHop: TongHopNhanVien[]): void {
  const ngayAll = tongHop.flatMap((t) => t.ketQuaNgay.map((k) => k.ngay)).sort()
  const tu = ngayAll[0]
  const den = ngayAll[ngayAll.length - 1]
  const ky = tu ? `kỳ ${tu.slice(5, 7)}/${tu.slice(0, 4)} · ${dmy(tu)} – ${dmy(den)}` : 'kỳ công'

  const daDung = new Set([TEN_TONG_HOP.toLowerCase(), khuonMay.name.toLowerCase()])
  const ten = tongHop.map((th) => tenSheet(th.tenBangLuong || th.tenMay || th.maNhanVien, daDung))

  // Tổng hợp
  const tong = wb.addWorksheet(TEN_TONG_HOP, { views: [{ state: 'frozen', ySplit: 4 }] })
  dongTieuDe(tong, 'BẢNG CHI TIẾT CÔNG', `${ky} · ${tongHop.length} nhân viên · bấm tên để xem từng ngày`)
  dongNhan(tong, 4, ['STT', 'Mã', 'Tên', 'Ngày công', 'Giờ OT', 'Số ngày đã sửa'])
  ;[6, 10, 28, 12, 10, 16].forEach((w, k) => (tong.getColumn(k + 1).width = w))
  let r = 5
  tongHop.forEach((th, i) => {
    const row = tong.getRow(r++)
    row.getCell(1).value = i + 1
    row.getCell(2).value = th.maNhanVien
    row.getCell(3).value = { text: th.tenBangLuong || th.tenMay, hyperlink: `#'${ten[i]}'!A1` }
    row.getCell(3).font = { color: { argb: MAU_TIEU_DE }, underline: true }
    row.getCell(4).value = so2(th.tongNgayCong)
    row.getCell(5).value = so2(th.tongGioOT)
    row.getCell(6).value = th.soDongCanXemLai
    row.commit()
  })
  const rt = tong.getRow(r)
  rt.getCell(3).value = 'Tổng cộng'
  rt.getCell(4).value = so2(tongHop.reduce((a, t) => a + t.tongNgayCong, 0))
  rt.getCell(5).value = so2(tongHop.reduce((a, t) => a + t.tongGioOT, 0))
  rt.getCell(6).value = tongHop.reduce((a, t) => a + t.soDongCanXemLai, 0)
  for (let k = 1; k <= 6; k++) {
    rt.getCell(k).font = { bold: true }
    rt.getCell(k).border = { top: { style: 'thin' } }
  }
  rt.commit()
  for (const k of [4, 5]) tong.getColumn(k).numFmt = '0.00'

  // Mỗi nhân viên một sheet
  tongHop.forEach((th, i) => {
    const ws = wb.addWorksheet(ten[i], { views: [{ state: 'frozen', ySplit: 4 }] })
    dongTieuDe(ws, th.tenBangLuong || th.tenMay, `mã ${th.maNhanVien} · ${ky}`)
    ws.getCell(2, 8).value = { text: '← Tổng hợp', hyperlink: `#'${TEN_TONG_HOP}'!A1` }
    ws.getCell(2, 8).font = { color: { argb: MAU_TIEU_DE }, underline: true }
    dongNhan(ws, 4, ['Ngày', 'Thứ', 'Vào sáng', 'Ra sáng', 'Vào chiều', 'Ra chiều', 'Giờ làm', 'Ngày công', 'Giờ OT', 'Ghi chú'])
    ;[8, 8, 10, 10, 10, 10, 9, 11, 9, 60].forEach((w, k) => (ws.getColumn(k + 1).width = w))
    let rr = 5
    for (const kq of th.ketQuaNgay) {
      const row = ws.getRow(rr++)
      const moc = [kq.capVaoRa[0]?.vao, kq.capVaoRa[0]?.ra, kq.capVaoRa[1]?.vao, kq.capVaoRa[1]?.ra]
      row.getCell(1).value = dmy(kq.ngay)
      row.getCell(2).value = kq.thu
      moc.forEach((m, k) => (row.getCell(3 + k).value = m ?? ''))
      // Ngày nghỉ cả ngày (không chấm, không sửa) để trống số — cột toàn số 0 khó nhìn (vòng 11)
      const nghi = kq.capVaoRa.length === 0 && !kq.daSua
      row.getCell(7).value = nghi ? '' : so2(kq.gioLamQ)
      row.getCell(8).value = nghi ? '' : kq.ngayCongR
      row.getCell(9).value = nghi ? '' : so2(kq.gioOtS)
      row.getCell(10).value = ghiChuNgay(kq)
      if (kq.daSua) for (const k of [3, 4, 5, 6, 10]) row.getCell(k).fill = vang()
      else if (kq.capVaoRa.length === 0)
        for (let k = 1; k <= 10; k++) row.getCell(k).font = { color: { argb: MAU_MO } }
      row.commit()
    }
    const t = ws.getRow(rr)
    t.getCell(1).value = 'Tổng'
    t.getCell(7).value = so2(th.ketQuaNgay.reduce((a, k) => a + k.gioLamQ, 0))
    t.getCell(8).value = so2(th.tongNgayCong)
    t.getCell(9).value = so2(th.tongGioOT)
    for (let k = 1; k <= 10; k++) {
      t.getCell(k).font = { bold: true }
      t.getCell(k).border = { top: { style: 'thin' } }
    }
    t.commit()
    for (const k of [7, 9]) ws.getColumn(k).numFmt = '0.00'
  })

  // Thứ tự: Tổng hợp → từng người → khuôn máy (cuối). exceljs sắp sheet theo orderNo.
  // (types của exceljs không khai `orderNo` dù runtime có — `workbook.worksheets` sắp theo nó)
  type CoThuTu = ExcelJS.Worksheet & { orderNo: number }
  const conLai = wb.worksheets.filter((w) => w !== tong && w !== khuonMay) as CoThuTu[]
  ;(tong as CoThuTu).orderNo = 0
  conLai.forEach((w, i) => (w.orderNo = i + 1))
  ;(khuonMay as CoThuTu).orderNo = conLai.length + 1
}

function chuoi(v: ExcelJS.CellValue): string {
  if (typeof v === 'string') return v.trim()
  if (v && typeof v === 'object') {
    const rt = (v as ExcelJS.CellRichTextValue).richText
    if (Array.isArray(rt)) return rt.map((t) => t.text).join('').trim()
  }
  return ''
}

function laNgay(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(
      v.getUTCDate()
    ).padStart(2, '0')}`
  }
  return null
}

/**
 * Ghi Q/R/S + mốc đã sửa vào MỘT dòng ngày, tô vàng ô nào khác mốc máy gốc — logic
 * dùng chung cho cả hai nguồn (file thật / dựng từ đầu cho nguồn máy LAN, vòng 5).
 * Trả về true nếu dòng có tô vàng (đếm vào `soDongToVang`).
 */
function ghiVaToVangMotDong(row: ExcelJS.Row, kq: KetQuaNgay): boolean {
  // Q/R/S tĩnh (cột Q=17, R=18, S=19)
  row.getCell(17).value = kq.gioLamQ
  row.getCell(18).value = kq.ngayCongR
  row.getCell(19).value = kq.gioOtS

  if (!kq.daSua) return false

  const moiPhang = [
    kq.capVaoRa[0]?.vao ?? null,
    kq.capVaoRa[0]?.ra ?? null,
    kq.capVaoRa[1]?.vao ?? null,
    kq.capVaoRa[1]?.ra ?? null
  ]
  for (let k = 0; k < 4; k++) {
    const goc = phutTrongNgay(kq.nguonGoc[k])
    const moi = phutTrongNgay(moiPhang[k])
    const cell = row.getCell(3 + k) // C..F
    if ((goc == null) !== (moi == null) || (goc != null && moi != null && goc !== moi)) {
      cell.value = moiPhang[k] ?? ''
      toVang(cell)
    }
  }
  // S bị ép 0 hoặc dòng cảnh báo → tô vàng ô S để dễ soi
  toVang(row.getCell(19))
  return true
}

export async function ghiChiTietDaLamSach(
  fileMay: string,
  duongDanRa: string,
  tongHop: TongHopNhanVien[]
): Promise<{ duongDanRa: string; soDongToVang: number }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(fileMay)
  const ws = wb.getWorksheet('Chi Tiet') || wb.worksheets[0]
  if (!ws) throw new LoiDocFileMay('KHONG_PHAI_FILE_MAY', 'File máy không đọc được.')

  const theoMa = new Map<string, Map<string, KetQuaNgay>>()
  for (const th of tongHop) {
    const m = new Map<string, KetQuaNgay>()
    for (const kq of th.ketQuaNgay) m.set(kq.ngay, kq)
    theoMa.set(chuanHoaMa(th.maNhanVien), m)
  }

  const headers: { row: number; ma: string }[] = []
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    const m = chuoi(row.getCell(1).value).match(RE_HEADER)
    if (m) headers.push({ row: r, ma: chuanHoaMa(m[1]) })
  })

  let soDongToVang = 0
  const last = ws.rowCount

  for (let hi = 0; hi < headers.length; hi++) {
    const h = headers[hi]
    const ketThuc = hi + 1 < headers.length ? headers[hi + 1].row : last + 1
    const theoNgay = theoMa.get(h.ma)
    if (!theoNgay) continue

    for (let r = h.row + 1; r < ketThuc; r++) {
      const row = ws.getRow(r)
      const ngay = laNgay(row.getCell(1).value)
      if (!ngay) continue
      const kq = theoNgay.get(ngay)
      if (!kq) continue
      if (ghiVaToVangMotDong(row, kq)) soDongToVang++
    }
  }

  themSheetDeDoc(wb, ws, tongHop)
  await ghiFileAtomic(wb, duongDanRa)

  return { duongDanRa, soDongToVang }
}

/**
 * Vòng 5 — nguồn "Đồng bộ từ máy" không có file .xlsx gốc để nhân bản layout (chỉ có
 * log thô qua LAN). Dựng workbook mới từ đầu, cùng cấu trúc cột với file máy thật
 * (A=ngày, C..H=3 cặp vào/ra, Q/R/S=17/18/19) để AC-2 vẫn đúng: S6 không phân biệt
 * được kỳ nạp từ đâu. Nguồn: (chi tiết đã làm sạch — nguồn máy).
 */
export async function ghiChiTietTuMocCham(
  duongDanRa: string,
  tongHop: TongHopNhanVien[]
): Promise<{ duongDanRa: string; soDongToVang: number }> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(TEN_KHUON_MAY)
  let soDongToVang = 0
  let r = 1

  for (const th of tongHop) {
    ws.getCell(r, 1).value = `Mã nhân viên: ${th.maNhanVien}   Tên nhân viên: ${
      th.tenBangLuong || th.tenMay
    }   Bộ phận: ------`
    r += 2 // dòng đệm, khớp khuôn "header + dòng ngày bắt đầu ngay dưới" của docFileMay

    for (const kq of th.ketQuaNgay) {
      const row = ws.getRow(r)
      const oNgay = row.getCell(1)
      oNgay.value = new Date(`${kq.ngay}T00:00:00Z`)
      oNgay.numFmt = 'yyyy-mm-dd'
      const moc = [
        kq.capVaoRa[0]?.vao ?? '',
        kq.capVaoRa[0]?.ra ?? '',
        kq.capVaoRa[1]?.vao ?? '',
        kq.capVaoRa[1]?.ra ?? ''
      ]
      for (let k = 0; k < 4; k++) row.getCell(3 + k).value = moc[k]
      // Cặp 3 (G/H) — công cụ KHÔNG tự sửa cặp 3 (chỉ cặp 1/2 đi vào capVaoRa, xem
      // phatHienBatThuong.ts), nên ghi thẳng mốc gốc như nguồn "Chọn file" vẫn giữ
      // nguyên cột G/H khi nhân bản file thật. Cùng vị trí cột đã hứa ở
      // 2026-09-05 ("A=ngày, C..H=3 cặp") — thiếu cột này thì audit-trail nguồn máy
      // kém trung thực hơn nguồn file (BH pha P vòng 5).
      row.getCell(7).value = kq.nguonGoc[4] ?? ''
      row.getCell(8).value = kq.nguonGoc[5] ?? ''
      if (ghiVaToVangMotDong(row, kq)) soDongToVang++
      row.commit()
      r++
    }
    r++ // dòng trống giữa hai khối nhân viên
  }

  themSheetDeDoc(wb, ws, tongHop)
  await ghiFileAtomic(wb, duongDanRa)
  return { duongDanRa, soDongToVang }
}
