// Vòng 7 — nguồn nạp/đồng bộ THÀNH CÔNG gần nhất, để tự chạy lại khi mở app (AC-1).

export type NguonGanNhat =
  | { loai: 'file'; duongDan: string }
  | { loai: 'may'; ip: string; port: number }

/** Field lạ/thiếu/hỏng → null, không throw (cùng cơ chế HienThi/CauHinhMayChamCong). */
export function chuanHoaNguonGanNhat(x: unknown): NguonGanNhat | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (o.loai === 'file' && typeof o.duongDan === 'string' && o.duongDan.trim() !== '') {
    return { loai: 'file', duongDan: o.duongDan }
  }
  if (
    o.loai === 'may' &&
    typeof o.ip === 'string' &&
    o.ip.trim() !== '' &&
    Number.isInteger(o.port) &&
    (o.port as number) >= 1 &&
    (o.port as number) <= 65535
  ) {
    return { loai: 'may', ip: o.ip, port: o.port as number }
  }
  return null
}
