// Phát hiện + tự sửa dòng chấm công bất thường.
//
// Bảng quy tắc:
//  1. Thiếu một mốc trong một cặp (ngày có chấm nhưng lệch) → điền mốc thiếu =
//     giờ tương ứng của ngày liền kề (trước, hoặc sau). Ép S = 0.
//  2. ra < vào trong một cặp / cặp cuối có ra thuộc hôm sau → bỏ mốc lạc, rồi xử như (1).
//  3. Q > 14 (ca dài — quên chấm nghỉ trưa) → giữ Q cho R, ép S = 0.
//  4. S tính ra > 4 và dòng chỉ có 1 cặp → ép S = 0.
//  5. Không chấm gì cả ngày → KHÔNG cảnh báo (nghỉ thật): Q=R=S=0, mức = none.

import type { DongNgayMay, KetQuaNgay } from './types'
import { phutTrongNgay, gioChuoi } from './time'
import { tinhQ, tinhR, tinhS } from './tinhQRS'

const MAC_DINH = [7 * 60, 11 * 60 + 30, 13 * 60 + 30, 17 * 60 + 30] // vào1 ra1 vào2 ra2
const KHE_TRUA_TOI_THIEU = 40 // phút
const CA_QUA_DAI = 14 // giờ
const OT_NGHI_NGO = 4 // giờ

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
      // Hai mốc: một "vào", một "ra", đúng thứ tự → một cặp làm việc.
      cap = [{ vao: moc[0].phut, ra: moc[1].phut }]
      if (!(moc[0].khe === 0 && moc[1].khe === 1)) {
        // không phải cặp sáng chuẩn (vd chỉ chấm cặp chiều, hoặc vào1+ra2 mất chấm trưa)
        // → thiếu lần chấm, ép OT = 0.
        epOtVe0 = true
        ghiChu.push('chỉ một cặp vào/ra do thiếu lần chấm, ép OT = 0')
      }
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

    // 4a. Một cặp liền phủ qua buổi trưa → gần như chắc chắn quên chấm nghỉ trưa
    //. Ép OT = 0 + tô vàng, độc lập với ngưỡng Q>14 / S>4 (BH-1).
    if (!epOtVe0 && cap.length === 1 && cap[0].ra - cap[0].vao > 6.5 * 60) {
      epOtVe0 = true
      ghiChu.push(
        `một ca liền ${((cap[0].ra - cap[0].vao) / 60).toFixed(1)}h phủ buổi trưa — nghi quên chấm nghỉ trưa, ép OT = 0`
      )
    }

    // 4b. OT nghi ngờ trên dòng chỉ 1 cặp (giữ lại làm lưới an toàn cho ca ngắn hơn)
    const sThu = tinhS(Q, nguongGioChuanNgay, false)
    if (!epOtVe0 && cap.length === 1 && sThu > OT_NGHI_NGO) {
      epOtVe0 = true
      ghiChu.push(`OT ${sThu.toFixed(1)}h trên một ca liền — nghi quên chấm nghỉ trưa, ép OT = 0`)
    }

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
