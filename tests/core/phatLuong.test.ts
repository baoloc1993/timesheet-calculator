// dùng chung S12 (phát từng người) + S13 (in phiếu). Luồng tiền quan trọng:
// đúng công thức 5 khoản + đúng phân biệt "chan" (chặn thật) vs "coDonGia" (rút gọn giải trình).
// Nguồn bug thật: e2e dùng nhầm `chan` để quyết định rút gọn — xem.
import { describe, it, expect } from 'vitest'
import { dungNguoiPhat, dsNguoiPhat } from '../../src/core/phatLuong'
import type { KetQuaKy, DongBang } from '../../src/core/ketQuaKy'

function ky(over: Partial<KetQuaKy> = {}): KetQuaKy {
  return {
    thang: '2026-09',
    ngayLuu: 'x',
    khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
    dongBang: [],
    khauTru: {},
    daTra: {},
    ...over
  }
}

function dong(over: Partial<DongBang> & Pick<DongBang, 'maNhanVien'>): DongBang {
  return {
    tenBangLuong: over.maNhanVien,
    ngayCong: 20,
    gioOT: 5,
    thanhTien: 6_000_000,
    soDongDaSua: 0,
    ...over
  }
}

describe('dungNguoiPhat — coDonGia (rút gọn) khác chan (chặn thật)', () => {
  it('kỳ lưu TRƯỚC vòng 6 (donGiaNgay/donGiaGioOT thiếu hẳn) → coDonGia=false, KHÔNG chan, tho=thanhTien', () => {
    const kq = ky({ dongBang: [dong({ maNhanVien: 'a', thanhTien: 7_000_000 })] })
    const p = dungNguoiPhat(kq, kq.dongBang[0])
    expect(p.coDonGia).toBe(false)
    expect(p.chan).toBeNull()
    expect(p.tho).toBe(7_000_000)
    expect(p.luongCong).toBe(0) // không có đơn giá đóng băng để tách — chỉ dùng thanhTien
    expect(p.tienOt).toBe(0)
  })

  it('đơn giá có mặt và CẢ HAI đều 0 → chan="chưa khai đơn giá", coDonGia=true', () => {
    const kq = ky({ dongBang: [dong({ maNhanVien: 'a', donGiaNgay: 0, donGiaGioOT: 0, thanhTien: 0 })] })
    const p = dungNguoiPhat(kq, kq.dongBang[0])
    expect(p.coDonGia).toBe(true)
    expect(p.chan).toBe('chưa khai đơn giá')
  })

  it('đơn giá có mặt và khác 0 → coDonGia=true, không chan, tách đúng công×giá + OT×giá', () => {
    const kq = ky({ dongBang: [dong({ maNhanVien: 'a', donGiaNgay: 300_000, donGiaGioOT: 70_000, ngayCong: 22, gioOT: 4 })] })
    const p = dungNguoiPhat(kq, kq.dongBang[0])
    expect(p.coDonGia).toBe(true)
    expect(p.chan).toBeNull()
    expect(p.luongCong).toBe(22 * 300_000)
    expect(p.tienOt).toBe(4 * 70_000)
    expect(p.tho).toBe(22 * 300_000 + 4 * 70_000)
  })
})

describe('dungNguoiPhat — 5 khoản itemize đúng cho giải trình', () => {
  it('field 5 khoản thiếu hẳn (kỳ cũ) → tất cả về 0, không throw', () => {
    const kq = ky({ dongBang: [dong({ maNhanVien: 'a' })] }) // không có chuyenCan/buLuong/le/baoHiem trên KetQuaKy
    const p = dungNguoiPhat(kq, kq.dongBang[0])
    expect(p.chuyenCan).toBe(0)
    expect(p.buLuong).toBe(0)
    expect(p.le).toBe(0)
    expect(p.baoHiem).toBe(0)
  })

  it('có đủ 5 khoản → mỗi field đọc đúng theo mã, thucNhan cộng/trừ đúng', () => {
    const kq = ky({
      dongBang: [dong({ maNhanVien: 'a', donGiaNgay: 300_000, donGiaGioOT: 70_000, ngayCong: 20, gioOT: 0, thanhTien: 6_000_000 })],
      khauTru: { a: 500_000 },
      chuyenCan: { a: 200_000 },
      buLuong: { a: 100_000 },
      le: { a: 50_000 },
      baoHiem: { a: 30_000 }
    })
    const p = dungNguoiPhat(kq, kq.dongBang[0])
    expect(p.chuyenCan).toBe(200_000)
    expect(p.buLuong).toBe(100_000)
    expect(p.le).toBe(50_000)
    expect(p.baoHiem).toBe(30_000)
    expect(p.khauTru).toBe(500_000)
    // 6.000.000 + 200.000 + 100.000 + 50.000 − 30.000 − 500.000 = 5.820.000
    expect(p.thucNhan).toBe(5_820_000)
  })
})

describe('dsNguoiPhat', () => {
  it('map đúng thứ tự dongBang, độ dài bằng nhau', () => {
    const kq = ky({ dongBang: [dong({ maNhanVien: 'a' }), dong({ maNhanVien: 'b' })] })
    const ds = dsNguoiPhat(kq)
    expect(ds).toHaveLength(2)
    expect(ds.map((p) => p.d.maNhanVien)).toEqual(['a', 'b'])
  })
})
