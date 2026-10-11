// Công thức Q/R/S — chép đúng công thức người dùng trong file máy.
//
//   Q (giờ làm): đủ 4 mốc (vào1,ra1,vào2,ra2) → (ra1−vào1)+(ra2−vào2)
//                chỉ có cặp 1 → ra1−vào1 ; else 0.  (Cặp 3 KHÔNG cộng — khớp công thức tay.)
//   R (ngày công): Q=0 → 0 · Q<5.5 → 0.5 · else 1.
//   S (giờ OT): Q > (ngưỡng + 0.1) → Q − ngưỡng · else 0.

import { gioGiua } from './time'

export interface CapVaoRa {
  vao: string | null
  ra: string | null
}

export interface KetQuaQRS {
  Q: number
  R: number
  S: number
}

const lam4 = (x: number) => Math.round(x * 10000) / 10000
const lam2 = (x: number) => Math.round(x * 100) / 100

export function tinhQ(capVaoRa: CapVaoRa[]): number {
  const c1 = capVaoRa[0]
  const c2 = capVaoRa[1]
  const d1 = c1 ? gioGiua(c1.vao, c1.ra) : null
  const d2 = c2 ? gioGiua(c2.vao, c2.ra) : null
  if (d1 != null && d2 != null) return lam4(d1 + d2)
  if (d1 != null) return lam4(d1)
  return 0
}

export function tinhR(Q: number): number {
  if (Q <= 0) return 0
  if (Q < 5.5) return 0.5
  return 1
}

/**
 * @param epOtVe0 dòng bị sửa vì thiếu/lộn mốc → ép S=0 bất kể Q.
 *
 * Cận Q so ở 2 chữ số thập phân (làm tròn phút): Q đúng bằng ngưỡng+0.1 (vd 8.20 với
 * ngưỡng 8.1) → KHÔNG tính OT, khớp luật "Q > ngưỡng+0.1". Không làm tròn thì bụi số
 * `8.1 + 0.1 = 8.200000000000001` và Q phù du làm kết quả nhảy ±0.1h ở đúng cận đó
 * back-test 2026-09-01 thấy 5 dòng lệch kiểu này (bảng tay Excel ra 0.10, luật ra 0).
 */
export function tinhS(Q: number, nguongGioChuanNgay: number, epOtVe0 = false): number {
  if (epOtVe0) return 0
  const nguongCan = lam2(nguongGioChuanNgay + 0.1)
  if (lam2(Q) > nguongCan) return lam4(Q - nguongGioChuanNgay)
  return 0
}

export function tinhQRS(
  capVaoRa: CapVaoRa[],
  nguongGioChuanNgay: number,
  epOtVe0 = false
): KetQuaQRS {
  const Q = tinhQ(capVaoRa)
  const R = tinhR(Q)
  const S = tinhS(Q, nguongGioChuanNgay, epOtVe0)
  return { Q, R, S }
}
