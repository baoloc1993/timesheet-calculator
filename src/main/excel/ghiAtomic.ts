// Ghi workbook ra đĩa an toàn: ghi file tạm rồi đổi tên đè lên đích.
// Ghi hỏng giữa chừng (hết đĩa, mất điện, file đích đang mở) → file đích cũ còn
// nguyên, không bị cụt. Chỗ duy nhất chạm fs khi ghi .xlsx.

import { renameSync, rmSync } from 'fs'
import type ExcelJS from 'exceljs'
import { LoiDocFileMay } from './docFileMay'

export async function ghiFileAtomic(wb: ExcelJS.Workbook, duongDanRa: string): Promise<void> {
  const tam = `${duongDanRa}.tmp-${process.pid}`
  try {
    await wb.xlsx.writeFile(tam)
    renameSync(tam, duongDanRa)
  } catch (e) {
    try {
      rmSync(tam, { force: true })
    } catch {
      // file tạm còn lại thì thôi, không chặn
    }
    const msg = (e as Error).message || ''
    if (/EBUSY|EPERM|locked|being used/i.test(msg)) {
      throw new LoiDocFileMay(
        'DANG_MO_O_EXCEL',
        `"${duongDanRa.split(/[\\/]/).pop()}" đang mở trong Excel. Đóng file đó rồi thử lại.`
      )
    }
    throw e
  }
}
