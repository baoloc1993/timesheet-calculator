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

import type { DongNgayMay, KetQuaNgay } from './types'
import { phutTrongNgay, gioChuoi } from './time'
import { tinhQ, tinhR, tinhS } from './tinhQRS'

const MAC_DINH = [7 * 60, 11 * 60 + 30, 13 * 60 + 30, 17 * 60 + 30] // vào1 ra1 vào2 ra2
const KHE_TRUA_TOI_THIEU = 40 // phút
const CA_QUA_DAI = 14 // giờ

interface Moc {
  phut: number
  khe: number // 0..3
}

function mocTuKetQua(kq: KetQuaNgay | undefined, khe: number): number | null {
  if (!kq) return null
  const cap = kq.capVaoRa[khe < 2 ? 0 : 1]
  if (!cap) return null
  return phutTrongNgay(khe % 2 === 0 ? cap.vao : cap.ra)
}

function mocTuThoRaw(dong: DongNgayMay | undefined, khe: number): number | null {
  if (!dong) return null
  return phutTrongNgay(dong.moc[khe])
}

export function tinhKetQuaNhanVien(
  dongNgay: DongNgayMay[],
  nguongGioChuanNgay: number
): KetQuaNgay[] {
  const ketQua: KetQuaNgay[] = []

  for (let i = 0; i < dongNgay.length; i++) {
    const dong = dongNgay[i]
    const nguonGoc = dong.moc.slice(0, 6)
    const ghiChu: string[] = []
    let epOtVe0 = false

    const dienKhe = (khe: number): number => {
      const truoc = mocTuKetQua(ketQua[i - 1], khe)
      if (truoc != null) return truoc
      const sau = mocTuThoRaw(dongNgay[i + 1], khe)
      if (sau != null) return sau
      return MAC_DINH[khe]
    }

    const co3 = phutTrongNgay(nguonGoc[4]) != null || phutTrongNgay(nguonGoc[5]) != null
    let moc: Moc[] = []
    for (let k = 0; k < 4; k++) {
      const p = phutTrongNgay(nguonGoc[k])
      if (p != null) moc.push({ phut: p, khe: k })
    }

    // 2. Bỏ mốc lạc: duyệt theo THỨ TỰ KHE, mốc nào không lớn hơn mốc hợp lệ gần nhất là lạc.
    const giuLai: Moc[] = []
    let maxHopLe = -1
    let coLon = false
    for (const m of moc) {
      if (m.phut > maxHopLe) {
        giuLai.push(m)
        maxHopLe = m.phut
      } else {
        coLon = true
      }
    }
    if (coLon) {
      moc = giuLai
      epOtVe0 = true
      ghiChu.push('bỏ mốc giờ lộn qua ngày, ép OT = 0')
    }

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
      // n === 3 → coi như thiếu một mốc trong hai cặp
      const m = moc
      epOtVe0 = true
      let kheMax = 1
      let doMax = -1
      for (let k = 1; k < 3; k++) {
        const d = m[k].phut - m[k - 1].phut
        if (d > doMax) {
          doMax = d
          kheMax = k
        }
      }
      const sang = m.slice(0, kheMax)
      const chieu = m.slice(kheMax)
      if (doMax < KHE_TRUA_TOI_THIEU || sang.length === 0 || chieu.length === 0) {
        cap = [
          { vao: m[0].phut, ra: m[1].phut },
          { vao: dienKhe(2), ra: m[2].phut }
        ]
        ghiChu.push('3 mốc không rõ nghỉ trưa, dựng lại theo ngày kề, ép OT = 0')
      } else if (sang.length === 1) {
        cap = [
          { vao: sang[0].phut, ra: dienKhe(1) },
          { vao: chieu[0].phut, ra: chieu.length > 1 ? chieu[1].phut : dienKhe(3) }
        ]
        ghiChu.push('thiếu giờ ra buổi sáng, điền theo ngày kề, ép OT = 0')
      } else {
        const a0 = chieu[0].phut
        if (a0 < 15 * 60) {
          cap = [
            { vao: sang[0].phut, ra: sang[1].phut },
            { vao: a0, ra: dienKhe(3) }
          ]
          ghiChu.push('thiếu giờ ra buổi chiều, điền theo ngày kề, ép OT = 0')
        } else {
          cap = [
            { vao: sang[0].phut, ra: sang[1].phut },
            { vao: dienKhe(2), ra: a0 }
          ]
          ghiChu.push('thiếu giờ vào buổi chiều, điền theo ngày kề, ép OT = 0')
        }
      }
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

    if (co3) ghiChu.push('có dữ liệu cặp 3 — kiểm tra tay')

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
