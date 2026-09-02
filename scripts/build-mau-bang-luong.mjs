// Sinh resources/mau-bang-luong.xlsx từ mẫu thật tháng 07 — thiết kế lại đẹp hơn
// (canh lề, tiêu đề, khoảng cách, font) nhưng GIỮ NGUYÊN bộ ô hợp đồng mà docBangLuong
// parse (thẻ 2 cột: "Tên:" / "Lương tháng:" / "Làm thêm"; cột Số lượng C/I, Đơn giá D/J).
//
// Chạy lại khi cần sửa hình thức mẫu:  node scripts/build-mau-bang-luong.mjs

import ExcelJS from 'exceljs'
import { resolve, dirname } from 'path'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NGUON = resolve(__dirname, '../deployment/local/mau/bang luong thang 07 (mau).xlsx')
const RA = resolve(__dirname, '../resources/mau-bang-luong.xlsx')

const FONT = 'Segoe UI'
const MAU_TIEUDE = 'FF004E92' // --color-primary
const MAU_TIEUDE_NHAT = 'FFE9F1FB' // --color-primary-soft
const MAU_NHAN = 'FFF2F2F5' // --color-surface-sunken

const RE_TEN = /^\s*(họ và\s+)?t[êe]n\s*:/i
const RE_KY = /^\s*\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/
const NHAN_HEADER = new Set(['đvt', 'số lượng', 'đơn giá', 'thành tiền'])
const NHAN_DAM = new Set(['tổng', 'lương tháng:', 'làm thêm', 'chuyên cần', 'bu lương', 'lễ', 'bảo hiểm', 'vay'])

function chuoi(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object' && Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').trim()
  return ''
}

const vien = () => ({ style: 'thin', color: { argb: 'FFD9D9D9' } })

async function main() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(NGUON)
  const ws = wb.worksheets[0]

  // Cột: A/G tên rộng, B/H ĐVT hẹp, C/I số lượng, D/J đơn giá, E/K thành tiền, F đệm.
  const rong = { A: 24, B: 9, C: 12, D: 14, E: 16, F: 3, G: 24, H: 9, I: 12, J: 14, K: 16 }
  for (const [c, w] of Object.entries(rong)) ws.getColumn(c).width = w

  const tong = Math.min(ws.rowCount, 5000)
  for (let r = 1; r <= tong; r++) {
    const row = ws.getRow(r)
    row.height = 20
    row.eachCell({ includeEmpty: false }, (cell) => {
      const t = chuoi(cell.value)
      const tl = t.toLowerCase()
      const base = { name: FONT, size: 11, color: { argb: 'FF1A1A1A' } }

      if (RE_TEN.test(t)) {
        cell.font = { ...base, size: 12.5, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU_TIEUDE } }
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      } else if (NHAN_HEADER.has(tl)) {
        cell.font = { ...base, size: 10, bold: true, italic: true, color: { argb: 'FF4B4B50' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU_NHAN } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (RE_KY.test(t)) {
        cell.font = { ...base, size: 10, italic: true, color: { argb: 'FF4B4B50' } }
      } else if (tl === 'tổng') {
        cell.font = { ...base, bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAU_TIEUDE_NHAT } }
      } else if (NHAN_DAM.has(tl)) {
        cell.font = { ...base, bold: tl === 'lương tháng:' || tl === 'làm thêm' }
      } else {
        cell.font = base
      }

      // Định dạng số + canh phải cho cột tiền / số lượng.
      const col = cell.address.replace(/\d+/, '')
      if (['C', 'I'].includes(col) && typeof cell.value === 'number') {
        cell.value = 0 // xoá số liệu kỳ cũ — mỗi kỳ điền lại
        cell.numFmt = '0.##'
        cell.alignment = { horizontal: 'right' }
      } else if (['D', 'E', 'J', 'K'].includes(col)) {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right' }
        if (['E', 'K'].includes(col)) cell.font = { ...cell.font, bold: true }
      }
    })
  }

  // Viền mảnh quanh vùng dữ liệu từng thẻ (nhẹ, gọn) — quét ô "Tên:" rồi kẻ 13 dòng dưới.
  for (let r = 1; r <= tong; r++) {
    const row = ws.getRow(r)
    for (const col of ['A', 'G']) {
      if (!RE_TEN.test(chuoi(row.getCell(col).value))) continue
      const cols = col === 'A' ? ['A', 'B', 'C', 'D', 'E'] : ['G', 'H', 'I', 'J', 'K']
      for (let k = 0; k <= 12 && r + k <= tong; k++) {
        for (const c of cols) {
          const cell = ws.getRow(r + k).getCell(c)
          cell.border = { top: vien(), left: vien(), bottom: vien(), right: vien() }
        }
      }
    }
  }

  ws.pageSetup = { paperSize: 9, orientation: 'portrait', margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } }

  mkdirSync(dirname(RA), { recursive: true })
  await wb.xlsx.writeFile(RA)
  console.log('Đã sinh', RA)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
