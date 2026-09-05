// Ghi file *chi tiết công đã làm sạch* — chép file máy, ghi giá trị Q/R/S tĩnh do
// công cụ tính, ghi đè mốc Vào/Ra đã sửa, tô nền vàng ô công cụ đã đụng.

import ExcelJS from 'exceljs'
import type { TongHopNhanVien, KetQuaNgay } from '../../core/types'
import { LoiDocFileMay } from './docFileMay'
import { phutTrongNgay } from '../../core/time'
import { chuanHoaMa } from '../../core/ma'
import { ghiFileAtomic } from './ghiAtomic'

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
  const ws = wb.addWorksheet('Chi Tiet')
  let soDongToVang = 0
  let r = 1

  for (const th of tongHop) {
    ws.getCell(r, 1).value = `Mã nhân viên: ${th.maNhanVien}   Tên nhân viên: ${
      th.tenBangLuong || th.tenMay
    }   Bộ phận: ------`
    r += 2 // dòng đệm, khớp khuôn "header + dòng ngày bắt đầu ngay dưới" của docFileMay

    for (const kq of th.ketQuaNgay) {
      const row = ws.getRow(r)
      row.getCell(1).value = new Date(`${kq.ngay}T00:00:00Z`)
      const moc = [
        kq.capVaoRa[0]?.vao ?? '',
        kq.capVaoRa[0]?.ra ?? '',
        kq.capVaoRa[1]?.vao ?? '',
        kq.capVaoRa[1]?.ra ?? ''
      ]
      for (let k = 0; k < 4; k++) row.getCell(3 + k).value = moc[k]
      if (ghiVaToVangMotDong(row, kq)) soDongToVang++
      row.commit()
      r++
    }
    r++ // dòng trống giữa hai khối nhân viên
  }

  await ghiFileAtomic(wb, duongDanRa)
  return { duongDanRa, soDongToVang }
}
