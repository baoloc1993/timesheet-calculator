// Đọc file .xlsx máy chấm công xuất ra → FileMayDaDoc (dữ liệu thuần cho src/core).
// Chỗ DUY NHẤT dùng exceljs để ĐỌC. Nguồn cấu trúc file: khảo sát file thật tháng 08/2026.
//
// Cấu trúc: sheet "Chi Tiet", các khối lặp; mỗi khối mở đầu bằng ô cột A
//   "Mã nhân viên: NNNNN   Tên nhân viên: X   Bộ phận: ------"
// Dòng ngày bắt đầu ~10 dòng dưới header khối, cột A là ngày (Date).
// Cột C..H = 3 cặp Vào/Ra ("HH:MM"), K = Công máy, M/N/O = tăng ca máy.

import ExcelJS from 'exceljs'
import type { FileMayDaDoc, KhoiFileMay, DongNgayMay } from '../../core/types'
import { chuanHoaMa } from '../../core/ma'

export class LoiDocFileMay extends Error {
  constructor(
    public ma: 'KHONG_PHAI_FILE_MAY' | 'FILE_HONG' | 'DANG_MO_O_EXCEL',
    message: string
  ) {
    super(message)
    this.name = 'LoiDocFileMay'
  }
}

const RE_HEADER = /Mã nhân viên:\s*(\S+)\s+Tên nhân viên:\s*(.+?)\s+Bộ phận/

function oChuoi(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const rt = (v as ExcelJS.CellRichTextValue).richText
    if (Array.isArray(rt)) return rt.map((t) => t.text).join('').trim()
    const f = v as ExcelJS.CellFormulaValue
    if ('result' in f && f.result != null) return oChuoi(f.result as ExcelJS.CellValue)
  }
  return ''
}

function oNgay(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(
      v.getUTCDate()
    ).padStart(2, '0')}`
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    const iso = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  }
  return null
}

function oGio(v: ExcelJS.CellValue): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2}):(\d{2})/)
    if (m) {
      const h = Number(m[1])
      const mm = Number(m[2])
      if (h <= 23 && mm <= 59) return `${String(h).padStart(2, '0')}:${m[2]}`
    }
    return null
  }
  if (v instanceof Date) {
    return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`
  }
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const total = Math.round(v * 1440)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }
  if (typeof v === 'object') {
    const f = v as ExcelJS.CellFormulaValue
    if ('result' in f) return oGio(f.result as ExcelJS.CellValue)
  }
  return null
}

function oSo(v: ExcelJS.CellValue): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v)
  if (v && typeof v === 'object') {
    const f = v as ExcelJS.CellFormulaValue
    if ('result' in f && typeof f.result === 'number') return f.result
  }
  return null
}

/**
 * Sheet dữ liệu khuôn máy của một workbook: tên "Chi Tiet", không có thì sheet đầu tiên có dòng
 * "Mã nhân viên:", cuối cùng mới tới sheet đầu. Dùng chung cho đọc (`docFileMay`) và ghi
 * (`ghiChiTietDaLamSach`) — hai đầu phải chọn cùng một sheet.
 */
export function sheetKhuonMay(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  const coKhoi = (w: ExcelJS.Worksheet): boolean => {
    let co = false
    w.eachRow({ includeEmpty: false }, (row) => {
      if (!co && /Mã nhân viên:/.test(String(row.getCell(1).text ?? ''))) co = true
    })
    return co
  }
  return wb.getWorksheet('Chi Tiet') || wb.worksheets.find(coKhoi) || wb.worksheets[0]
}

export async function docFileMay(duongDan: string): Promise<FileMayDaDoc> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.readFile(duongDan)
  } catch (e) {
    const msg = (e as Error).message || ''
    if (/EBUSY|EPERM|locked|being used/i.test(msg)) {
      throw new LoiDocFileMay('DANG_MO_O_EXCEL', 'File đang mở trong Excel. Đóng file đó rồi thử lại.')
    }
    throw new LoiDocFileMay('FILE_HONG', 'Không mở được file. File có thể hỏng hoặc không phải .xlsx.')
  }

  // file chi tiết xuất ra có sheet "Tổng hợp" đứng đầu — không có sheet "Chi Tiet" thì
  // chọn sheet đầu tiên có dòng "Mã nhân viên:" (khuôn máy), không lấy mù sheet đầu.
  const ws = sheetKhuonMay(wb)
  if (!ws) {
    throw new LoiDocFileMay('KHONG_PHAI_FILE_MAY', 'Không tìm thấy dữ liệu chấm công trong file.')
  }

  // 1. tìm dòng mở đầu mỗi khối
  const headerRows: { row: number; ma: string; ten: string }[] = []
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    const a = oChuoi(row.getCell(1).value)
    const m = a.match(RE_HEADER)
    if (m) headerRows.push({ row: r, ma: m[1], ten: m[2].trim() })
  })

  if (headerRows.length === 0) {
    throw new LoiDocFileMay(
      'KHONG_PHAI_FILE_MAY',
      'Không đọc được khối nhân viên nào — kiểm tra đúng là file máy chấm công xuất ra (sheet "Chi Tiet").'
    )
  }

  const lastRow = ws.rowCount
  const khoi: KhoiFileMay[] = []
  const tatCaNgay: string[] = []

  for (let bi = 0; bi < headerRows.length; bi++) {
    const h = headerRows[bi]
    const ketThuc = bi + 1 < headerRows.length ? headerRows[bi + 1].row : lastRow + 1
    const dongNgay: DongNgayMay[] = []

    for (let r = h.row + 1; r < ketThuc; r++) {
      const row = ws.getRow(r)
      const ngay = oNgay(row.getCell(1).value)
      if (!ngay) continue // dòng tổng / header con / ký tên
      const moc = [
        oGio(row.getCell(3).value), // C Vào1
        oGio(row.getCell(4).value), // D Ra1
        oGio(row.getCell(5).value), // E Vào2
        oGio(row.getCell(6).value), // F Ra2
        oGio(row.getCell(7).value), // G Vào3
        oGio(row.getCell(8).value) // H Ra3
      ]
      const ot =
        (oSo(row.getCell(13).value) || 0) +
        (oSo(row.getCell(14).value) || 0) +
        (oSo(row.getCell(15).value) || 0)
      dongNgay.push({
        ngay,
        thu: oChuoi(row.getCell(2).value),
        moc,
        congMay: oSo(row.getCell(11).value),
        otMay: ot
      })
      tatCaNgay.push(ngay)
    }

    const ma = chuanHoaMa(h.ma)
    const trung = khoi.find((k) => k.maNhanVien === ma)
    if (trung) {
      // Khối trùng mã trong cùng file (máy lỗi / sửa tay) → gộp ngày, không cộng đôi.
      for (const d of dongNgay) {
        if (!trung.dongNgay.some((x) => x.ngay === d.ngay)) trung.dongNgay.push(d)
      }
      trung.dongNgay.sort((a, b) => a.ngay.localeCompare(b.ngay))
    } else {
      khoi.push({ maNhanVien: ma, tenMay: h.ten, dongNgay })
    }
  }

  tatCaNgay.sort()
  const ngayBatDau = tatCaNgay[0] || ''
  const ngayKetThuc = tatCaNgay[tatCaNgay.length - 1] || ''
  const thang = ngayBatDau ? ngayBatDau.slice(0, 7) : ''

  return { thang, ngayBatDau, ngayKetThuc, khoi }
}
