// đọc số tiền thành chữ tiếng Việt (S13, phiếu lương). Hàm thuần.
// Cổng từ bản thiết kế (hàm docSo/doc3, mockup người dùng tự dựng)
// không dùng Intl (kết quả phải khớp chính xác cách đọc kế toán quen dùng).

const DVSO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

/** Đọc một nhóm 3 chữ số (0–999). `coHangTramTruocDo` = nhóm cao hơn khác 0 → ép đọc "không trăm lẻ…". */
function doc3(n: number, coHangTramTruocDo: boolean): string {
  const tram = Math.floor(n / 100)
  const chuc = Math.floor(n / 10) % 10
  const donvi = n % 10
  let s = ''
  if (tram > 0 || coHangTramTruocDo) s += DVSO[tram] + ' trăm'
  if (chuc === 0) {
    if (donvi > 0) s += (tram > 0 || coHangTramTruocDo ? ' lẻ ' : '') + DVSO[donvi]
  } else if (chuc === 1) {
    s += (s ? ' ' : '') + 'mười'
    if (donvi === 5) s += ' lăm'
    else if (donvi > 0) s += ' ' + DVSO[donvi]
  } else {
    s += (s ? ' ' : '') + DVSO[chuc] + ' mươi'
    if (donvi === 1) s += ' mốt'
    else if (donvi === 5) s += ' lăm'
    else if (donvi > 0) s += ' ' + DVSO[donvi]
  }
  return s.trim()
}

/** Số tiền VND → chữ tiếng Việt, ví dụ 6435000 → "Sáu triệu bốn trăm ba mươi lăm nghìn đồng". */
export function docSoTienBangChu(n: number): string {
  if (!n) return 'Không đồng'
  const am = n < 0
  let so = Math.abs(Math.round(n))
  const donVi = ['', ' nghìn', ' triệu', ' tỷ']
  const nhom: number[] = []
  while (so > 0) {
    nhom.push(so % 1000)
    so = Math.floor(so / 1000)
  }
  const out: string[] = []
  for (let k = nhom.length - 1; k >= 0; k--) {
    if (nhom[k] === 0) continue
    out.push(doc3(nhom[k], k < nhom.length - 1) + donVi[k])
  }
  let s = out.join(' ').replace(/\s+/g, ' ').trim()
  s = s.charAt(0).toUpperCase() + s.slice(1) + ' đồng'
  return am ? 'Âm ' + s.charAt(0).toLowerCase() + s.slice(1) : s
}
