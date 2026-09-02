// Đường dẫn mẫu bảng lương NHÚNG SẴN (vòng 3 — bỏ bước "chọn file mẫu" ở S6).

import { app } from 'electron'
import { join, resolve } from 'path'
import { existsSync } from 'fs'

/**
 * Bản đóng gói: `resources/mau-bang-luong.xlsx` nằm cạnh app (`process.resourcesPath`,
 * khai `extraResources` trong electron-builder.yml).
 * Dev / test: file trong repo tại `<repo>/resources/mau-bang-luong.xlsx`
 * (main chạy từ `out/main/` nên lùi 2 cấp).
 * `TSC_MAU_BANG_LUONG` ghi đè — chỉ dùng khi dev/test.
 */
export function duongDanMauBangLuong(): string {
  const ghiDe = process.env.TSC_MAU_BANG_LUONG
  if (ghiDe && !app.isPackaged && existsSync(ghiDe)) return ghiDe

  if (app.isPackaged) {
    return join(process.resourcesPath, 'mau-bang-luong.xlsx')
  }
  return resolve(__dirname, '../../resources/mau-bang-luong.xlsx')
}
