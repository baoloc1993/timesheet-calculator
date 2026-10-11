// Chuẩn hoá mã nhân viên — một chỗ duy nhất, dùng cho cả lúc parse file máy, lưu Setup,
// và ghép trong xuLyKyCong.
// Máy luôn xuất mã 5 chữ số zero-pad ("00015"); người dùng có thể gõ "15" → cùng một người.
//
// file bảng lương 2 cột đôi khi để mã DÍNH tên có chữ số ("00003 My83").
// Lấy CỤM CHỮ SỐ ĐẦU TIÊN, không gộp mọi chữ số — nếu không "My83" bơm 83 vào mã
// ("00003"+"83" = "0000383"). ("chuanHoaMa bóc chữ số bám tên").

/** "15" / " 00015 " / "NV15" / "00003 My83" → "00015" / "00003". Không chữ số nào → chuỗi đã trim. */
export function chuanHoaMa(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  const m = s.match(/\d+/)
  return m ? m[0].padStart(5, '0') : s
}
