import { describe, it, expect } from 'vitest'
import { xuLyKyCong, tinhLaiMotDong, tinhLaiTongHop, tongToanKy } from '../../src/core/xuLyKyCong'
import { tinhThanhTien } from '../../src/core/tinhThanhTien'
import type { FileMayDaDoc, NhanVien, DongNgayMay } from '../../src/core/types'

// Vòng 2 (AC-2): sau khi người dùng sửa tay một dòng ở S3, "thành tiền" của nhân viên đó
// và tổng thành tiền cả kỳ phải tính lại theo tổng ngày công / giờ OT MỚI — nếu không,
// S7 hiện số tiền cũ → trả lương sai.

function ngay(d: string, moc: (string | null)[]): DongNgayMay {
  return { ngay: d, thu: '', moc: [...moc, null, null, null, null, null, null].slice(0, 6), congMay: null, otMay: null }
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

const ngayThuong = ['07:00', '11:00', '13:00', '17:00'] // Q=8 → R=1, S=0 (ngưỡng 8.1)

describe('thành tiền tính lại sau khi sửa tay (S3 → S7)', () => {
  it('sửa một dòng làm tăng OT → thanhTien của nhân viên tăng đúng bằng OT thêm × đơn giá OT', () => {
    const file: FileMayDaDoc = {
      thang: '2026-08',
      ngayBatDau: '2026-08-01',
      ngayKetThuc: '2026-08-31',
      khoi: [
        {
          maNhanVien: '00006',
          tenMay: 'Linh',
          dongNgay: [ngay('2026-08-01', ngayThuong), ngay('2026-08-02', ngayThuong)]
        }
      ]
    }
    const nvLinh = nv({ maNhanVien: '00006', tenMay: 'Linh', donGiaNgay: 275000, donGiaGioOT: 70000 })
    const kq = xuLyKyCong(file, [nvLinh])
    const th = kq.tongHop[0]
    expect(th.tongGioOT).toBe(0)
    expect(th.thanhTien).toBe(tinhThanhTien(2, 0, 275000, 70000))

    // người dùng kéo giờ ra buổi chiều tới 21:00 → Q = 4 + 8 = 12, OT = 12 − 8.1 = 3.9
    const kqNgay = [...th.ketQuaNgay]
    kqNgay[0] = tinhLaiMotDong(kqNgay[0], [{ vao: '07:00', ra: '11:00' }, { vao: '13:00', ra: '21:00' }], 8.1)
    const thMoi = tinhLaiTongHop(th, kqNgay)

    expect(thMoi.tongGioOT).toBeCloseTo(3.9, 4)
    expect(thMoi.tongNgayCong).toBe(2)
    // thành tiền phải khớp công thức trên tổng MỚI, không giữ số cũ
    expect(thMoi.thanhTien).toBe(tinhThanhTien(thMoi.tongNgayCong, thMoi.tongGioOT, 275000, 70000))
    expect(thMoi.thanhTien - th.thanhTien).toBeCloseTo(3.9 * 70000, 0)
  })

  it('tổng thành tiền cả kỳ đổi theo sau khi thay tổng hợp một nhân viên đã sửa', () => {
    const file: FileMayDaDoc = {
      thang: '2026-08',
      ngayBatDau: '2026-08-01',
      ngayKetThuc: '2026-08-31',
      khoi: [
        { maNhanVien: 'A', tenMay: 'A', dongNgay: [ngay('2026-08-01', ngayThuong)] },
        { maNhanVien: 'B', tenMay: 'B', dongNgay: [ngay('2026-08-01', ngayThuong)] }
      ]
    }
    const kq = xuLyKyCong(file, [
      nv({ maNhanVien: 'A', tenMay: 'A', donGiaNgay: 300000, donGiaGioOT: 70000 }),
      nv({ maNhanVien: 'B', tenMay: 'B', donGiaNgay: 245000, donGiaGioOT: 65000 })
    ])
    const tongCu = kq.tongThanhTienCaKy

    const thA = kq.tongHop.find((t) => t.maNhanVien === 'A')!
    const kqNgayA = [tinhLaiMotDong(thA.ketQuaNgay[0], [{ vao: '07:00', ra: '11:00' }, { vao: '13:00', ra: '19:00' }], 8.1)]
    const thAMoi = tinhLaiTongHop(thA, kqNgayA) // Q=10 → OT 1.9

    const tongHopMoi = kq.tongHop.map((t) => (t.maNhanVien === 'A' ? thAMoi : t))
    const tongMoi = tongToanKy(tongHopMoi)

    expect(tongMoi.tongThanhTienCaKy).toBe(tongHopMoi.reduce((s, t) => s + t.thanhTien, 0))
    expect(tongMoi.tongThanhTienCaKy - tongCu).toBeCloseTo(1.9 * 70000, 0)
    expect(tongMoi.tongGioOTCaKy).toBeCloseTo(1.9, 4)
  })
})
