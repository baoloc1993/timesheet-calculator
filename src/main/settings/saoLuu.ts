// Sao lưu config.json TRƯỚC khi migration đổi schema.
//
// Vì sao: dữ liệu bền duy nhất của app là ~20 dòng nhân viên trong config.json. Không có
// PaaS/DB để bật backup tự động. Điểm rủi ro thật sự là migration bump schema: nếu bước
// migrate sai, config.json hỏng thì mất toàn bộ Setup. Chép một bản .bak ngay trước khi
// đổi là đủ để lùi (rollback §5: khôi phục config.json.bak).

import { copyFileSync, existsSync } from 'fs'

/** Chép `<configPath>` → `<configPath>.bak` nếu file tồn tại. Trả về đường dẫn .bak, hoặc null. */
export function saoLuuTruocMigrate(configPath: string): string | null {
  if (!existsSync(configPath)) return null
  const bak = configPath + '.bak'
  copyFileSync(configPath, bak)
  return bak
}
