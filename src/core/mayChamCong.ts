// Cấu hình kết nối máy chấm công (vòng 5) — hàm thuần, không phụ thuộc Electron.

export interface CauHinhMayChamCong {
  ip: string
  port: number
}

// Cổng 4370 — mặc định thật của node-zklib (test.js chính chủ) và của máy ZKTeco-compatible
// người dùng cung cấp — sửa từ giả định sai "4970" ở pha V.
export const MAC_DINH_CAU_HINH_MAY: CauHinhMayChamCong = { ip: '', port: 4370 }

const RE_IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function ipHopLe(ip: string): boolean {
  const m = String(ip ?? '').trim().match(RE_IPV4)
  if (!m) return false
  return m.slice(1, 5).every((o) => Number(o) <= 255)
}

export function congHopLe(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/** Field lạ/thiếu/hỏng → về mặc định từng field, không throw (cùng cơ chế HienThi vòng 4). */
export function chuanHoaCauHinhMay(x: Partial<CauHinhMayChamCong> | undefined | null): CauHinhMayChamCong {
  return {
    ip: typeof x?.ip === 'string' ? x.ip.trim() : MAC_DINH_CAU_HINH_MAY.ip,
    port: congHopLe(Number(x?.port)) ? Number(x!.port) : MAC_DINH_CAU_HINH_MAY.port
  }
}
