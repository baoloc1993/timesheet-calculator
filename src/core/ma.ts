// Chuẩn hoá mã nhân viên — một chỗ duy nhất, dùng cho cả lúc parse file máy, lưu Setup,
// và ghép trong xuLyKyCong.
// Máy luôn xuất mã 5 chữ số zero-pad ("00015"); người dùng có thể gõ "15" → cùng một người.

/** "15" / " 00015 " / "NV15" → "00015". Không có chữ số nào → trả chuỗi đã trim (giữ nguyên). */
export function chuanHoaMa(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  const so = s.replace(/\D/g, '')
  return so ? so.padStart(5, '0') : s
}
