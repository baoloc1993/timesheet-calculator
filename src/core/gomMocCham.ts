// Gom log thô máy chấm công (mỗi lần chạm vân tay một dòng) thành CÙNG cấu trúc mà
// docFileMay() tạo ra từ file Excel — đi thẳng vào xuLyKyCong() sẵn có, không có luồng
// tính công riêng cho nguồn máy.

import type { FileMayDaDoc, KhoiFileMay, DongNgayMay } from './types'
import { chuanHoaMa } from './ma'
import { gioChuoi } from './time'

/** Một lần chạm vân tay, đọc thô qua node-zklib (`src/main/mayChamCong/ketNoi.ts`). */
export interface MocChamTho {
  userId: string | number
  timestamp: Date
}

export interface KetQuaGomMocCham {
  file: FileMayDaDoc
  /** Cảnh báo không chặn luồng — ví dụ ngày có > 6 mốc, đã bỏ mốc dư. */
  canhBao: string[]
}

const MAX_MOC_MOI_NGAY = 6 // tối đa 3 cặp vào/ra — cùng giới hạn cột C..H của file máy

function ngayIso(d: Date): string {
  // Giờ máy trả về là giờ địa phương của thiết bị — Date ở đây coi như "giờ tường" (wall clock).
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * `tu`/`den`: "YYYY-MM-DD" — lọc log trong khoảng ngày (bao gồm hai đầu) trước khi gom.
 * Sắp mốc trong ngày tăng dần, ghép cặp lẻ→vào chẵn→ra (tối đa 3 cặp); quá 6 mốc/ngày
 * cho một người → giữ 3 cặp đầu, mốc dư bị bỏ + ghi cảnh báo (không throw, không chặn).
 */
export function gomMocCham(logTho: MocChamTho[], tu: string, den: string): KetQuaGomMocCham {
  const canhBao: string[] = []
  const theoMaNgay = new Map<string, Map<string, Date[]>>()

  for (const m of logTho) {
    const ngay = ngayIso(m.timestamp)
    if (ngay < tu || ngay > den) continue
    const ma = chuanHoaMa(String(m.userId))
    if (!ma) continue
    if (!theoMaNgay.has(ma)) theoMaNgay.set(ma, new Map())
    const theoNgay = theoMaNgay.get(ma)!
    if (!theoNgay.has(ngay)) theoNgay.set(ngay, [])
    theoNgay.get(ngay)!.push(m.timestamp)
  }

  const khoi: KhoiFileMay[] = []
  const tatCaNgay: string[] = []

  for (const [ma, theoNgay] of [...theoMaNgay].sort((a, b) => a[0].localeCompare(b[0]))) {
    const dongNgay: DongNgayMay[] = []
    for (const ngay of [...theoNgay.keys()].sort()) {
      const moc = theoNgay.get(ngay)!.slice().sort((a, b) => a.getTime() - b.getTime())
      if (moc.length > MAX_MOC_MOI_NGAY) {
        canhBao.push(
          `Mã ${ma} ngày ${ngay}: có ${moc.length - MAX_MOC_MOI_NGAY} mốc dư, đã bỏ (giữ ${
            MAX_MOC_MOI_NGAY / 2
          } cặp đầu)`
        )
      }
      const capMoc: (string | null)[] = [null, null, null, null, null, null]
      moc.slice(0, MAX_MOC_MOI_NGAY).forEach((d, i) => {
        capMoc[i] = gioChuoi(d.getHours() * 60 + d.getMinutes())
      })
      dongNgay.push({ ngay, thu: '', moc: capMoc, congMay: null, otMay: null })
      tatCaNgay.push(ngay)
    }
    // tenMay: máy không trả tên qua giao thức — dùng chính mã làm định danh hiển thị
    // tạm; khớp Setup thì tên thật lấy từ NhanVien.tenMay (xuLyKyCong), không đụng đây.
    khoi.push({ maNhanVien: ma, tenMay: ma, dongNgay })
  }

  tatCaNgay.sort()
  const ngayBatDau = tatCaNgay[0] || tu
  const ngayKetThuc = tatCaNgay[tatCaNgay.length - 1] || den
  const thang = ngayBatDau.slice(0, 7)

  return { file: { thang, ngayBatDau, ngayKetThuc, khoi }, canhBao }
}
