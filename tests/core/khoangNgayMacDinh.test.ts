import { describe, it, expect } from 'vitest'
import { khoangNgayMacDinh } from '../../src/core/khoangNgayMacDinh'

// Chốt qua chat người dùng 2026-09-09: mùng 1-5 trả lương, công tính từ mùng 1 đến hết
// tháng trước. Ngưỡng ngày≤5 khớp `chonKyMacDinh` nhưng hàm này KHÔNG dùng
// chung — mục đích khác (khoảng ngày ĐỒNG BỘ, không phải kỳ HIỂN THỊ).

describe('khoangNgayMacDinh', () => {
  describe('ngày ≤ 5 — tháng TRƯỚC', () => {
    it('ngày đúng 5 vẫn thuộc nhánh tháng trước (ranh giới)', () => {
      const ketQua = khoangNgayMacDinh(new Date(2026, 8, 5)) // 05/09/2026
      expect(ketQua).toEqual({ tu: '2026-08-01', den: '2026-08-31' })
    })

    it('mùng 1 — tháng trước có 31 ngày', () => {
      const ketQua = khoangNgayMacDinh(new Date(2026, 8, 1)) // 01/09/2026 → tháng 8 (31 ngày)
      expect(ketQua).toEqual({ tu: '2026-08-01', den: '2026-08-31' })
    })

    it('tháng trước có 30 ngày (tháng 9 → mùng 1-5 tháng 10)', () => {
      const ketQua = khoangNgayMacDinh(new Date(2026, 9, 3)) // 03/10/2026 → tháng 9 (30 ngày)
      expect(ketQua).toEqual({ tu: '2026-09-01', den: '2026-09-30' })
    })

    it('tháng trước là tháng 2 năm thường (28 ngày)', () => {
      const ketQua = khoangNgayMacDinh(new Date(2026, 2, 4)) // 04/03/2026 → tháng 2/2026 (28 ngày)
      expect(ketQua).toEqual({ tu: '2026-02-01', den: '2026-02-28' })
    })

    it('tháng trước là tháng 2 năm nhuận (29 ngày)', () => {
      const ketQua = khoangNgayMacDinh(new Date(2028, 2, 2)) // 02/03/2028 → tháng 2/2028 (nhuận)
      expect(ketQua).toEqual({ tu: '2028-02-01', den: '2028-02-29' })
    })

    it('qua năm — mùng 1-5 tháng 1 lấy tháng 12 năm trước', () => {
      const ketQua = khoangNgayMacDinh(new Date(2027, 0, 3)) // 03/01/2027
      expect(ketQua).toEqual({ tu: '2026-12-01', den: '2026-12-31' })
    })
  })

  describe('ngày > 5 — giữ nguyên hành vi cũ (đầu tháng hiện tại → hôm nay)', () => {
    it('ngày đúng 6 (ranh giới)', () => {
      const ketQua = khoangNgayMacDinh(new Date(2026, 8, 6))
      expect(ketQua).toEqual({ tu: '2026-09-01', den: '2026-09-06' })
    })

    it('giữa tháng', () => {
      const ketQua = khoangNgayMacDinh(new Date(2026, 8, 20))
      expect(ketQua).toEqual({ tu: '2026-09-01', den: '2026-09-20' })
    })
  })
})
