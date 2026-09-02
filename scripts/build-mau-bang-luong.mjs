// Sinh resources/mau-bang-luong.xlsx — KHUÔN TRỐNG (chỉ tiêu đề + bề rộng cột + khổ in).
// Vòng 3 (pha E): mẫu công ty viết tay có cấu trúc thẻ không đều → xuất ra lệch cột, dòng
// trống rải rác, khó nhìn. Bỏ hẳn các thẻ mẫu — `ghiBangLuong.themThe` dựng MỌI thẻ theo
// một khuôn cố định (lưới đều, 2 cột thẳng hàng, có viền). Khuôn trống → không mang tên /
// số lương của ai vào .exe và không còn thẻ "giữ số cũ" thừa.
//
// Bộ ô hợp đồng (Số lượng ngày/giờ, Đơn giá) + các nhãn docBangLuong parse ("Tên:",
// "Lương tháng", "Làm thêm") do `ghiBangLuong.ts` ghi ra khi xuất — không nằm ở file này.

import ExcelJS from 'exceljs'
import { resolve, dirname } from 'path'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RA = resolve(__dirname, '../resources/mau-bang-luong.xlsx')

const FONT = 'Segoe UI'
const MAU_TIEUDE = 'FF004E92' // --color-primary

async function main() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Bảng lương')

  // Cột: A/G tên rộng, B/H ĐVT hẹp, C/I số lượng, D/J đơn giá, E/K thành tiền, F đệm giữa 2 cụm.
  const rong = { A: 26, B: 8, C: 11, D: 13, E: 15, F: 3, G: 26, H: 8, I: 11, J: 13, K: 15 }
  for (const [c, w] of Object.entries(rong)) ws.getColumn(c).width = w

  // Dòng tiêu đề (ghiBangLuong sẽ điền kỳ vào ô A2 khi xuất).
  const t = ws.getCell('A1')
  t.value = 'BẢNG LƯƠNG'
  t.font = { name: FONT, size: 15, bold: true, color: { argb: MAU_TIEUDE } }
  ws.getRow(1).height = 26
  const k = ws.getCell('A2')
  k.value = 'Kỳ: __________'
  k.font = { name: FONT, size: 10, italic: true, color: { argb: 'FF4B4B50' } }
  ws.getRow(2).height = 18

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }
  }

  mkdirSync(dirname(RA), { recursive: true })
  await wb.xlsx.writeFile(RA)
  console.log('Đã sinh', RA, '(khuôn trống — thẻ do ghiBangLuong dựng)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
