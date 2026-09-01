import { describe, it, expect } from 'vitest'
import { tinhThanhTien } from '../../src/core/tinhThanhTien'
import { xuLyKyCong } from '../../src/core/xuLyKyCong'
import type { FileMayDaDoc, NhanVien, DongNgayMay } from '../../src/core/types'

// Vòng 2 (AC-2): thành tiền hiển thị ở S7 = Σ ngày công × đơn giá ngày + Σ giờ OT × đơn giá giờ OT.

describe('tinhThanhTien — hàm thuần', () => {
  it('ngày công × đơn giá ngày + giờ OT × đơn giá giờ OT', () => {
    expect(tinhThanhTien(26.5, 18.4, 240000, 70000)).toBe(26.5 * 240000 + 18.4 * 70000)
  })

  it('OT = 0 → chỉ tính ngày công', () => {
    expect(tinhThanhTien(24, 0, 245000, 65000)).toBe(24 * 245000)
  })

  it('làm tròn về đồng (không để số lẻ do nhân số thực)', () => {
    const r = tinhThanhTien(24.5, 4.48, 240000, 70000)
    expect(Number.isInteger(r)).toBe(true)
  })
})

function ngay(d: string, moc: (string | null)[]): DongNgayMay {
  return {
    ngay: d,
    thu: '',
    moc: [...moc, null, null, null, null, null, null].slice(0, 6),
    congMay: null,
    otMay: null
  }
}

function nv(over: Partial<NhanVien> & Pick<NhanVien, 'maNhanVien' | 'tenMay'>): NhanVien {
  return {
    id: 'id-' + over.maNhanVien,
    tenBangLuong: over.tenMay,
    nguongGioChuanNgay: 8.1,
    donGiaNgay: 300000,
    donGiaGioOT: 70000,
    an: false,
    ...over
  }
}

describe('xuLyKyCong — thành tiền dẫn xuất trên tổng hợp + tổng kỳ', () => {
  it('mỗi nhân viên có thanhTien; tổng kỳ = Σ thanhTien', () => {
    const file: FileMayDaDoc = {
      thang: '2026-08',
      ngayBatDau: '2026-08-01',
      ngayKetThuc: '2026-08-31',
      khoi: [
        {
          maNhanVien: '00002',
          tenMay: 'Hai',
          dongNgay: [
            ngay('2026-08-01', ['07:00', '11:00', '13:00', '17:00']),
            ngay('2026-08-02', ['07:00', '11:00', '13:00', '17:00'])
          ]
        },
        {
          maNhanVien: '00006',
          tenMay: 'Linh',
          dongNgay: [ngay('2026-08-01', ['07:00', '11:00', '13:00', '19:00'])] // Q=10 → OT 1.9
        }
      ]
    }
    const kq = xuLyKyCong(file, [
      nv({ maNhanVien: '00002', tenMay: 'Hai', donGiaNgay: 245000, donGiaGioOT: 65000 }),
      nv({ maNhanVien: '00006', tenMay: 'Linh', donGiaNgay: 275000, donGiaGioOT: 70000 })
    ])

    const hai = kq.tongHop.find((t) => t.maNhanVien === '00002')!
    const linh = kq.tongHop.find((t) => t.maNhanVien === '00006')!
    expect(hai.thanhTien).toBe(tinhThanhTien(hai.tongNgayCong, hai.tongGioOT, 245000, 65000))
    expect(linh.thanhTien).toBe(tinhThanhTien(linh.tongNgayCong, linh.tongGioOT, 275000, 70000))
    expect(kq.tongThanhTienCaKy).toBe(hai.thanhTien + linh.thanhTien)
  })
})
