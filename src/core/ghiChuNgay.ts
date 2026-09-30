// Ghi chú hiển thị cho một ngày công — dùng chung màn S8 "Giải trình & sửa công" và file chi
// tiết công xuất ra (vòng 11), để hai nơi nói cùng một câu cho cùng một ngày.
import type { KetQuaNgay } from './types'

export function ghiChuNgay(kq: KetQuaNgay): string {
  if (kq.ghiChuSua) return kq.ghiChuSua
  if (kq.capVaoRa.length === 0) return 'nghỉ cả ngày'
  if (kq.capVaoRa.length === 1)
    return kq.ngayCongR === 1
      ? 'chấm một cặp vào/ra — tính cả ngày (phủ trưa), không tính OT'
      : 'chấm một cặp vào/ra — nửa công, không tính OT'
  return 'khớp gốc — công cụ không đụng vào'
}
