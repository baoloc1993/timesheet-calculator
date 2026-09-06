import { describe, it, expect } from 'vitest'
import { chonKyMacDinh } from '../../src/core/chonKy'

// Điểm dễ sai nhất: ngày ≤5 ưu tiên TUYỆT ĐỐI
// kỳ đã lưu gần nhất trước tháng hiện tại, BẤT KỂ có kỳ đang mở hay không.

describe('chonKyMacDinh', () => {
  describe('ngày ≤ 5 trong tháng — luôn ưu tiên kỳ đã lưu gần nhất trước tháng hiện tại', () => {
    it('ngày đúng 5 vẫn thuộc nhánh đầu tháng (ranh giới)', () => {
      const ketQua = chonKyMacDinh(['2026-08'], new Date(2026, 8, 5), false) // tháng 9/2026, ngày 5
      expect(ketQua).toEqual({ loai: 'da-luu', thang: '2026-08' })
    })

    it('bỏ qua kỳ đang mở dù coKyDangMo=true — kỳ đang mở KHÔNG phải mặc định khi ngày ≤5', () => {
      const ketQua = chonKyMacDinh(['2026-08'], new Date(2026, 8, 3), true)
      expect(ketQua).toEqual({ loai: 'da-luu', thang: '2026-08' })
    })

    it('nhiều kỳ đã lưu không sắp xếp sẵn, xuyên năm — chọn đúng kỳ GẦN NHẤT (không phải đầu/cuối mảng)', () => {
      // đang ở 2027-01, ngày 2 → tìm tháng lớn nhất < "2027-01"
      const danhSach = ['2026-12', '2026-02', '2026-11']
      const ketQua = chonKyMacDinh(danhSach, new Date(2027, 0, 2), false)
      expect(ketQua).toEqual({ loai: 'da-luu', thang: '2026-12' })
    })

    it('mảng không sort chứa cả hai chữ số tháng (09 vs 10) — chọn đúng theo thời gian, không lệch kiểu lexicographic sai', () => {
      // đang ở 2026-11, ngày 1 → tháng lớn nhất < "2026-11" phải là "2026-10", không phải "2026-09"
      const danhSach = ['2026-02', '2026-10', '2026-09']
      const ketQua = chonKyMacDinh(danhSach, new Date(2026, 10, 1), false)
      expect(ketQua).toEqual({ loai: 'da-luu', thang: '2026-10' })
    })

    it('không có kỳ đã lưu nào trước tháng hiện tại → khong-co', () => {
      const ketQua = chonKyMacDinh(['2026-09', '2026-10'], new Date(2026, 8, 1), false)
      expect(ketQua).toEqual({ loai: 'khong-co' })
    })

    it('danh sách rỗng → khong-co', () => {
      const ketQua = chonKyMacDinh([], new Date(2026, 8, 1), true)
      expect(ketQua).toEqual({ loai: 'khong-co' })
    })
  })

  describe('ngày > 5 trong tháng', () => {
    it('ngày đúng 6 đã thuộc nhánh sau đầu tháng (ranh giới)', () => {
      const ketQua = chonKyMacDinh([], new Date(2026, 8, 6), true)
      expect(ketQua).toEqual({ loai: 'dang-mo' })
    })

    it('coKyDangMo=true → dang-mo bất kể danh sách kỳ đã lưu', () => {
      const ketQua = chonKyMacDinh(['2026-09', '2020-01'], new Date(2026, 8, 15), true)
      expect(ketQua).toEqual({ loai: 'dang-mo' })
    })

    it('coKyDangMo=false, có kỳ đã lưu khớp đúng tháng hiện tại → da-luu tháng đó', () => {
      const ketQua = chonKyMacDinh(['2026-08', '2026-09'], new Date(2026, 8, 15), false)
      expect(ketQua).toEqual({ loai: 'da-luu', thang: '2026-09' })
    })

    it('coKyDangMo=false, không có kỳ khớp đúng tháng hiện tại (dù có tháng khác) → khong-co', () => {
      const ketQua = chonKyMacDinh(['2026-08', '2026-07'], new Date(2026, 8, 15), false)
      expect(ketQua).toEqual({ loai: 'khong-co' })
    })

    it('danh sách rỗng, coKyDangMo=false → khong-co', () => {
      const ketQua = chonKyMacDinh([], new Date(2026, 8, 15), false)
      expect(ketQua).toEqual({ loai: 'khong-co' })
    })
  })
})
