// Ghi file *chi tiết công đã làm sạch* — chép file máy, ghi giá trị Q/R/S tĩnh do
// công cụ tính, ghi đè mốc Vào/Ra đã sửa, tô nền vàng ô công cụ đã đụng.

import ExcelJS from 'exceljs'
import type { TongHopNhanVien, KetQuaNgay } from '../../core/types'
import { LoiDocFileMay } from './docFileMay'
import { phutTrongNgay } from '../../core/time'

const VANG: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF4CE' } // --color-warning-bg
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
    theoMa.set(th.maNhanVien, m)
  }

  const headers: { row: number; ma: string }[] = []
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    const m = chuoi(row.getCell(1).value).match(RE_HEADER)
    if (m) headers.push({ row: r, ma: m[1] })
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

      // Q/R/S tĩnh (cột Q=17, R=18, S=19)
      row.getCell(17).value = kq.gioLamQ
      row.getCell(18).value = kq.ngayCongR
      row.getCell(19).value = kq.gioOtS

      if (kq.daSua) {
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
            cell.fill = VANG
          }
        }
        // S bị ép 0 hoặc dòng cảnh báo → tô vàng ô S để dễ soi
        row.getCell(19).fill = VANG
        soDongToVang++
      }
    }
  }

  try {
    await wb.xlsx.writeFile(duongDanRa)
  } catch (e) {
    const msg = (e as Error).message || ''
    if (/EBUSY|EPERM|locked|being used/i.test(msg)) {
      throw new LoiDocFileMay(
        'DANG_MO_O_EXCEL',
        `"${duongDanRa.split(/[\\/]/).pop()}" đang mở trong Excel. Đóng file đó rồi thử lại.`
      )
    }
    throw e
  }

  return { duongDanRa, soDongToVang }
}
