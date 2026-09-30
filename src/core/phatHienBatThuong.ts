// Phát hiện + tự sửa dòng chấm công bất thường.
//
// Bảng quy tắc:
//  1. Thiếu một mốc trong một cặp (ngày có chấm nhưng lệch) → điền mốc thiếu =
//     giờ tương ứng của ngày liền kề (trước, hoặc sau). Ép S = 0.
//  2. ra < vào trong một cặp / cặp cuối có ra thuộc hôm sau → bỏ mốc lạc, rồi xử như (1).
//  3. Q > 14 (ca dài — quên chấm nghỉ trưa) trên dòng ≥ 2 cặp → giữ Q cho R, ép S = 0.
//  4. Chấm đúng MỘT cặp vào/ra → S = 0, KHÔNG cảnh báo. R tuỳ cặp:
//       phủ trưa (vào < 12:00 và ra > 13:30) → R = 1 (làm cả ngày, quên chấm trưa);
//       chỉ một buổi → R = 0.5 (nửa công).
//     người dùng chốt 2026-09-01 (back-test pha E). Thay luật cũ "1 cặp > 6.5h phủ trưa →
//     vàng + ép OT=0" (BH-1) và "S>4 trên 1 cặp → ép OT=0".
//  5. Không chấm gì cả ngày → KHÔNG cảnh báo (nghỉ thật): Q=R=S=0, mức = none.
//
// Vòng 10 pha E:
//  · Đọc mốc ở CẢ 6 cột máy — máy hay đẩy lần chấm ra về muộn sang cột cặp 3, ngày đủ 4 lần
//    chấm từng bị coi là "thiếu 1 mốc". Tổng đúng 4 mốc → hai cặp bình thường, không ép OT.
//  · Ngày 3 mốc: gán từng mốc vào khe (vào sáng / ra sáng / vào chiều / ra chiều) gần GIỜ QUEN
//    của chính người đó nhất (trung vị các ngày đủ 4 mốc trong kỳ), thay luật cũ "khoảng hở dài
//    nhất = nghỉ trưa" — ca sáng ~5 tiếng luôn dài hơn nghỉ trưa nên luật cũ đoán sai.
//  · Mốc thiếu điền từ NGÀY GẦN NHẤT CÓ ĐỦ 4 MỐC THÔ (trước rồi sau), không lấy kết quả ngày
//    trước — ngày trước chỉ một cặp phủ trưa thì "ra sáng" của nó thật ra là giờ ra chiều.

import type { DongNgayMay, KetQuaNgay } from './types'
import { phutTrongNgay, gioChuoi } from './time'
import { tinhQ, tinhR, tinhS } from './tinhQRS'

const MAC_DINH = [7 * 60, 11 * 60 + 30, 13 * 60 + 30, 17 * 60 + 30] // vào1 ra1 vào2 ra2
const CA_QUA_DAI = 14 // giờ

interface Moc {
  phut: number
  khe: number // 0..3
}

/** Mốc hợp lệ của một ngày theo THỨ TỰ CỘT (6 cột máy), bỏ mốc lạc (không lớn hơn mốc trước). */
function mocHopLe(nguonGoc: (string | null)[]): { moc: Moc[]; coLon: boolean } {
  const moc: Moc[] = []
  let coLon = false
  for (let k = 0; k < 6; k++) {
    const p = phutTrongNgay(nguonGoc[k])
    if (p == null) continue
    if (moc.length && p <= moc[moc.length - 1].phut) coLon = true
    else moc.push({ phut: p, khe: k })
  }
  return { moc, coLon }
}

function trungVi(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2)
}

/** Giờ quen của một người cho 4 khe = trung vị các ngày đủ đúng 4 mốc; thiếu dữ liệu → mặc định. */
function gioQuen(ngayDu4: number[][]): number[] {
  if (ngayDu4.length === 0) return MAC_DINH
  return [0, 1, 2, 3].map((k) => trungVi(ngayDu4.map((m) => m[k])))
}

/** Ngày 3 mốc: bỏ trống khe nào thì tổng lệch so với giờ quen nhỏ nhất. */
function khe3Moc(phut: number[], quen: number[]): { khe: number[]; thieu: number } {
  let tot = { khe: [0, 1, 2], thieu: 3, lech: Infinity }
  for (let thieu = 0; thieu < 4; thieu++) {
    const khe = [0, 1, 2, 3].filter((k) => k !== thieu)
    const lech = khe.reduce((t, k, j) => t + Math.abs(phut[j] - quen[k]), 0)
    if (lech < tot.lech) tot = { khe, thieu, lech }
  }
  return { khe: tot.khe, thieu: tot.thieu }
}

export function tinhKetQuaNhanVien(
  dongNgay: DongNgayMay[],
  nguongGioChuanNgay: number
): KetQuaNgay[] {
  const ketQua: KetQuaNgay[] = []
  // Mốc thô đã lọc của cả kỳ — dùng để điền mốc thiếu và tính giờ quen (vòng 10 pha E).
  const mocKy = dongNgay.map((d) => mocHopLe(d.moc.slice(0, 6)).moc.map((m) => m.phut))
  const quen = gioQuen(mocKy.filter((m) => m.length === 4))

  for (let i = 0; i < dongNgay.length; i++) {
    const dong = dongNgay[i]
    const nguonGoc = dong.moc.slice(0, 6)
    const ghiChu: string[] = []
    let epOtVe0 = false

    // Điền khe thiếu = giờ khe đó của ngày gần nhất có đủ 4 mốc thô (trước trước, rồi sau),
    // không có thì giờ quen của người đó.
    const dienKhe = (khe: number): number => {
      for (let d = 1; d < dongNgay.length; d++) {
        for (const j of [i - d, i + d]) if (mocKy[j]?.length === 4) return mocKy[j][khe]
      }
      return quen[khe]
    }

    // 2. Bỏ mốc lạc (cả 6 cột, theo thứ tự cột) — mốc nào không lớn hơn mốc hợp lệ trước là lạc.
    const hl = mocHopLe(nguonGoc)
    let moc = hl.moc
    if (hl.coLon) {
      epOtVe0 = true
      ghiChu.push('bỏ mốc giờ lộn qua ngày, ép OT = 0')
    }
    // Lần chấm thứ 5–6 thật (cặp 3) → vẫn dựng 2 cặp từ 4 mốc đầu, nhắc kiểm tay như cũ.
    const co3 = moc.length > 4
    if (co3) moc = moc.slice(0, 4)
    // Máy đẩy mốc sang cột cặp 3 nhưng tổng chỉ ≤ 4 → gộp vào, ghi rõ để người dùng hiểu.
    const gopCot3 = !co3 && moc.some((m) => m.khe >= 4)
    if (gopCot3) ghiChu.push('máy ghi một lần chấm ở cột cặp 3 — đã gộp vào giờ trong ngày')

    const n = moc.length

    // 5. nghỉ cả ngày
    if (n === 0) {
      ketQua.push({
        ngay: dong.ngay,
        thu: dong.thu,
        capVaoRa: [],
        nguonGoc,
        gioLamQ: 0,
        ngayCongR: 0,
        gioOtS: 0,
        daSua: false,
        otBiEp: false,
        ghiChuSua: '',
        mucDoCanhBao: 'none'
      })
      continue
    }

    // 1/3. dựng cặp vào/ra
    let cap: { vao: number; ra: number }[] = []

    if (n === 4 && moc[1].phut < moc[2].phut) {
      cap = [
        { vao: moc[0].phut, ra: moc[1].phut },
        { vao: moc[2].phut, ra: moc[3].phut }
      ]
    } else if (n === 2 && moc[0].khe % 2 === 0 && moc[1].khe % 2 === 1) {
      // MỘT CẶP VÀO/RA (chấm đúng một lần vào + một lần ra). người dùng chốt 2026-09-01
      // (back-test pha E, khớp 256/263 ngày lịch sử):
      //  · cặp PHỦ TRƯA (vào trước 12:00 và ra sau 13:30) → làm cả ngày, quên chấm trưa
      //    → R = 1, S = 0, KHÔNG cảnh báo.
      //  · cặp CHỈ MỘT BUỔI (chỉ sáng, hoặc chỉ chiều) → NỬA CÔNG: R = 0.5, S = 0, KHÔNG cảnh báo.
      // Thay luật cũ BH-1 ("1 cặp > 6.5h phủ trưa → vàng + ép OT=0") và "S>4 trên 1 cặp".
      const c = { vao: gioChuoi(moc[0].phut), ra: gioChuoi(moc[1].phut) }
      const phuTrua = moc[0].phut < 12 * 60 && moc[1].phut > 13 * 60 + 30
      ketQua.push({
        ngay: dong.ngay,
        thu: dong.thu,
        capVaoRa: [c],
        nguonGoc,
        gioLamQ: Math.round(tinhQ([c]) * 10000) / 10000,
        ngayCongR: phuTrua ? 1 : 0.5,
        gioOtS: 0,
        daSua: false,
        otBiEp: false,
        ghiChuSua: '',
        mucDoCanhBao: 'none'
      })
      continue
    } else if (n === 1) {
      epOtVe0 = true
      const p = moc[0].phut
      if (p < 12 * 60) {
        cap = [{ vao: p, ra: dienKhe(1) }]
        ghiChu.push('thiếu giờ ra buổi sáng, điền theo ngày kề, ép OT = 0')
      } else if (p < 15 * 60) {
        cap = [
          { vao: dienKhe(0), ra: dienKhe(1) },
          { vao: p, ra: dienKhe(3) }
        ]
        ghiChu.push('chỉ có giờ vào buổi chiều, điền các mốc còn lại theo ngày kề, ép OT = 0')
      } else {
        cap = [
          { vao: dienKhe(0), ra: dienKhe(1) },
          { vao: dienKhe(2), ra: p }
        ]
        ghiChu.push('chỉ có giờ ra cuối ngày, điền các mốc còn lại theo ngày kề, ép OT = 0')
      }
    } else if (n === 2) {
      // Hai mốc cùng loại (2 "vào" / 2 "ra") hoặc thứ tự lạ → không dựng được cặp,
      // điền cả hai cặp theo ngày kề, ép OT = 0 (BH-2).
      epOtVe0 = true
      cap = [
        { vao: dienKhe(0), ra: dienKhe(1) },
        { vao: dienKhe(2), ra: dienKhe(3) }
      ]
      ghiChu.push('mốc chấm không dựng được cặp vào/ra, điền theo ngày kề, ép OT = 0')
    } else {
      // n === 3 → thiếu đúng một khe; khe nào do giờ quen của người đó quyết (vòng 10 pha E).
      epOtVe0 = true
      const { khe, thieu } = khe3Moc(moc.map((m) => m.phut), quen)
      const gio = [0, 0, 0, 0]
      khe.forEach((k, j) => (gio[k] = moc[j].phut))
      gio[thieu] = dienKhe(thieu)
      cap = [
        { vao: gio[0], ra: gio[1] },
        { vao: gio[2], ra: gio[3] }
      ]
      const TEN = ['thiếu giờ vào buổi sáng', 'thiếu giờ ra buổi sáng', 'thiếu giờ vào buổi chiều', 'thiếu giờ ra buổi chiều']
      ghiChu.push(`${TEN[thieu]}, điền theo ngày gần nhất chấm đủ, ép OT = 0`)
    }

    const capChuoi = cap.map((c) => ({ vao: gioChuoi(c.vao), ra: gioChuoi(c.ra) }))
    let Q = tinhQ(capChuoi)

    // 3. ca quá dài
    if (Q > CA_QUA_DAI) {
      epOtVe0 = true
      ghiChu.push(`ca dài bất thường (${Q.toFixed(1)}h), không tính OT`)
    }

    // (Luật cũ 4a "một cặp liền > 6.5h phủ trưa → vàng" và 4b "S>4 trên một cặp → ép OT=0"
    //  đã bỏ — dòng chỉ một cặp vào/ra nay xử ở nhánh n===2 phía trên: nửa công, không cảnh báo.)

    if (co3)
      ghiChu.push(
        `máy ghi thêm lần chấm ${hl.moc.slice(4).map((m) => gioChuoi(m.phut)).join(', ')} (cặp 3) — chưa tính vào giờ làm; ` +
          'nếu là giờ ra/vào thật thì sửa lại 4 ô giờ cho đúng'
      )

    // đối chiếu mốc đã dựng với gốc
    const dungPhang = [
      capChuoi[0]?.vao ?? null,
      capChuoi[0]?.ra ?? null,
      capChuoi[1]?.vao ?? null,
      capChuoi[1]?.ra ?? null
    ]
    let khacGoc = false
    for (let k = 0; k < 4; k++) {
      const g = phutTrongNgay(nguonGoc[k])
      const d = phutTrongNgay(dungPhang[k])
      if ((g == null) !== (d == null) || (g != null && d != null && g !== d)) khacGoc = true
    }

    const daSua = khacGoc || epOtVe0 || co3
    const R = tinhR(Q)
    const S = tinhS(Q, nguongGioChuanNgay, epOtVe0)
    Q = Math.round(Q * 10000) / 10000

    ketQua.push({
      ngay: dong.ngay,
      thu: dong.thu,
      capVaoRa: capChuoi,
      nguonGoc,
      gioLamQ: Q,
      ngayCongR: R,
      gioOtS: S,
      daSua,
      otBiEp: epOtVe0,
      ghiChuSua: daSua ? ghiChu.join('; ') || 'công cụ đã điều chỉnh' : '',
      mucDoCanhBao: daSua ? 'vang' : 'none'
    })
  }

  return ketQua
}
