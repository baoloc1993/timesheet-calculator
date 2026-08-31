// Giờ trong file máy lưu dạng chuỗi "HH:MM" (không phải serial Excel).

/** "HH:MM" → phút trong ngày. Chuỗi rỗng / null / sai định dạng → null. */
export function phutTrongNgay(s: string | null | undefined): number | null {
  if (s == null) return null
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

/** Phút trong ngày → "HH:MM". */
export function gioChuoi(phut: number): string {
  const p = Math.max(0, Math.round(phut))
  const h = Math.floor(p / 60) % 24
  const mm = p % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Số giờ (thập phân) giữa hai mốc "HH:MM", làm tròn 4 chữ số. */
export function gioGiua(vao: string | null, ra: string | null): number | null {
  const a = phutTrongNgay(vao)
  const b = phutTrongNgay(ra)
  if (a == null || b == null) return null
  return Math.round(((b - a) / 60) * 10000) / 10000
}
