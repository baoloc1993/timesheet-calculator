// nguồn nạp/đồng bộ THÀNH CÔNG gần nhất, để tự chạy lại khi mở app.

import { congHopLe } from './mayChamCong'

export type NguonGanNhat =
  | { loai: 'file'; duongDan: string }
  | { loai: 'may'; ip: string; port: number }

/** Field lạ/thiếu/hỏng → null, không throw (cùng cơ chế HienThi/CauHinhMayChamCong). */
export function chuanHoaNguonGanNhat(x: unknown): NguonGanNhat | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (o.loai === 'file' && typeof o.duongDan === 'string' && o.duongDan.trim() !== '') {
    return { loai: 'file', duongDan: o.duongDan.trim() }
  }
  if (o.loai === 'may' && typeof o.ip === 'string' && o.ip.trim() !== '' && congHopLe(o.port as number)) {
    return { loai: 'may', ip: o.ip.trim(), port: o.port as number }
  }
  return null
}
