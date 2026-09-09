// Vòng 9 — khoảng ngày mặc định cho "Đồng bộ từ máy" (tự động khi mở app — AC-1 vòng 7 —
// và form S1 khi bấm tay). Dùng CHUNG cho main (`nguon-gan-nhat:tu-dong-nap`) và renderer
// (`S1NapFile.tsx`) qua preload/api-types.ts, một chỗ đổi luật, hai nơi dùng đúng như nhau.

const p2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Ngày-trong-tháng ≤ 5: tháng TRƯỚC — mùng 1
 * đến ngày cuối tháng trước, tính bằng `new Date(year, month, 0)` (ngày 0 lùi về ngày cuối
 * tháng trước, tự đúng cho mọi độ dài tháng kể cả tháng 2 và qua năm). Ngày > 5: giữ nguyên
 * hành vi cũ từ vòng 5 — đầu tháng hiện tại đến hôm nay.
 */
export function khoangNgayMacDinh(now: Date): { tu: string; den: string } {
  if (now.getDate() <= 5) {
    const cuoiThangTruoc = new Date(now.getFullYear(), now.getMonth(), 0)
    const nam = cuoiThangTruoc.getFullYear()
    const thang = cuoiThangTruoc.getMonth() + 1
    return {
      tu: `${nam}-${p2(thang)}-01`,
      den: `${nam}-${p2(thang)}-${p2(cuoiThangTruoc.getDate())}`
    }
  }
  const tu = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-01`
  const den = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`
  return { tu, den }
}
