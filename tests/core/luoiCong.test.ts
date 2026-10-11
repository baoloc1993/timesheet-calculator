// bảng công cả tháng (S11). Ký hiệu ngày + suy Chủ Nhật từ lịch thật.
import { describe, it, expect, afterEach } from 'vitest'
import { dungKyHieuNgay, ngayLaChuNhat } from '../../src/core/luoiCong'

describe('dungKyHieuNgay — suy ký hiệu từ ngayCongR', () => {
  it('ngayCongR=1 → X, bất kể Chủ Nhật hay không', () => {
    expect(dungKyHieuNgay(1, false)).toBe('X')
    expect(dungKyHieuNgay(1, true)).toBe('X')
  })

  it('ngayCongR=0.5 → ½, bất kể Chủ Nhật hay không', () => {
    expect(dungKyHieuNgay(0.5, false)).toBe('½')
    expect(dungKyHieuNgay(0.5, true)).toBe('½')
  })

  it('ngayCongR=0 và là Chủ Nhật → CN (không phải Vắng)', () => {
    expect(dungKyHieuNgay(0, true)).toBe('CN')
  })

  it('ngayCongR=0 và không phải Chủ Nhật → vang (Vắng)', () => {
    expect(dungKyHieuNgay(0, false)).toBe('vang')
  })
})

describe('ngayLaChuNhat — mốc ngày biết chắc chắn (kiểm bằng quy tắc Doomsday, không bịa)', () => {
  // Doomsday 2026 (thế kỷ 2000 mỏ neo = Thứ Ba; 26 + floor(26/4)=6 → 32 mod 7 = 4 →
  // Thứ Ba + 4 = Thứ Bảy). 8/8 là một ngày doomsday → 08/08/2026 = Thứ Bảy.
  // → 02/08/2026 (lùi 6 ngày) = Chủ Nhật.
  it('2026-08-02 là Chủ Nhật (Doomsday 08/08/2026 = Thứ Bảy, lùi 6 ngày)', () => {
    expect(ngayLaChuNhat('2026-08-02')).toBe(true)
  })

  it('2026-08-03 (Thứ Hai liền sau) không phải Chủ Nhật', () => {
    expect(ngayLaChuNhat('2026-08-03')).toBe(false)
  })

  // 9/5 cũng là một ngày doomsday (mnemonic "9 to 5 at the 7-Eleven") → 05/09/2026 = Thứ Bảy
  // → 06/09/2026 (hôm sau) = Chủ Nhật.
  it('2026-09-06 là Chủ Nhật (Doomsday 05/09/2026 = Thứ Bảy, hôm sau)', () => {
    expect(ngayLaChuNhat('2026-09-06')).toBe(true)
  })

  it('2026-09-05 (Thứ Bảy liền trước) không phải Chủ Nhật', () => {
    expect(ngayLaChuNhat('2026-09-05')).toBe(false)
  })
})

describe('ngayLaChuNhat — bền với múi giờ máy chạy (hàm dùng Date.UTC)', () => {
  const tzGoc = process.env.TZ

  afterEach(() => {
    if (tzGoc === undefined) delete process.env.TZ
    else process.env.TZ = tzGoc
  })

  it('kết quả không đổi dù process chạy ở TZ khác xa VN (UTC+14, UTC-12, giờ VN)', () => {
    process.env.TZ = 'Pacific/Kiritimati' // UTC+14
    expect(ngayLaChuNhat('2026-08-02')).toBe(true)
    expect(ngayLaChuNhat('2026-08-03')).toBe(false)

    process.env.TZ = 'Etc/GMT+12' // UTC-12
    expect(ngayLaChuNhat('2026-08-02')).toBe(true)
    expect(ngayLaChuNhat('2026-08-03')).toBe(false)

    process.env.TZ = 'Asia/Ho_Chi_Minh'
    expect(ngayLaChuNhat('2026-08-02')).toBe(true)
    expect(ngayLaChuNhat('2026-08-03')).toBe(false)
  })
})

describe('ngayLaChuNhat — định dạng ngày sai không được throw, không được báo nhầm là Chủ Nhật', () => {
  it('chuỗi rỗng → false', () => {
    expect(() => ngayLaChuNhat('')).not.toThrow()
    expect(ngayLaChuNhat('')).toBe(false)
  })

  it('thiếu phần ngày ("YYYY-MM" cụt) → false', () => {
    expect(ngayLaChuNhat('2026-08')).toBe(false)
  })

  it('chuỗi không phải ngày → false', () => {
    expect(ngayLaChuNhat('không phải ngày')).toBe(false)
  })

  it('có phần giờ ISO đầy đủ phía sau vẫn đọc đúng phần ngày đầu chuỗi', () => {
    expect(ngayLaChuNhat('2026-08-02T10:00:00.000Z')).toBe(true)
    expect(ngayLaChuNhat('2026-08-03T23:59:59.000Z')).toBe(false)
  })
})
