import { describe, it, expect } from 'vitest'
import { phutTrongNgay, gioChuoi, gioGiua } from '../../src/core/time'

// Parse sai ở đây = mọi phép Q/R/S phía sau lệch → sai tiền lương.

describe('phutTrongNgay — parse "HH:MM"', () => {
  it('giờ hợp lệ → phút trong ngày', () => {
    expect(phutTrongNgay('07:30')).toBe(450)
    expect(phutTrongNgay('00:00')).toBe(0)
    expect(phutTrongNgay('23:59')).toBe(1439)
  })

  it('giờ một chữ số vẫn nhận (máy có thể ghi "7:05")', () => {
    expect(phutTrongNgay('7:05')).toBe(425)
  })

  it('rỗng / null / undefined → null (không phải 0)', () => {
    expect(phutTrongNgay('')).toBeNull()
    expect(phutTrongNgay('   ')).toBeNull()
    expect(phutTrongNgay(null)).toBeNull()
    expect(phutTrongNgay(undefined)).toBeNull()
  })

  it('sai định dạng → null, không đoán bừa', () => {
    expect(phutTrongNgay('abc')).toBeNull()
    expect(phutTrongNgay('7h30')).toBeNull()
    expect(phutTrongNgay('7:5')).toBeNull() // phút phải 2 chữ số
    expect(phutTrongNgay('07:30:00')).toBeNull()
  })

  it('giờ/phút ngoài biên → null', () => {
    expect(phutTrongNgay('24:00')).toBeNull()
    expect(phutTrongNgay('25:15')).toBeNull()
    expect(phutTrongNgay('08:60')).toBeNull()
    expect(phutTrongNgay('08:99')).toBeNull()
  })
})

describe('gioChuoi — phút → "HH:MM"', () => {
  it('round-trip với phutTrongNgay', () => {
    for (const s of ['06:53', '11:19', '13:34', '18:05', '00:00', '23:45']) {
      expect(gioChuoi(phutTrongNgay(s)!)).toBe(s)
    }
  })
})

describe('gioGiua — số giờ giữa hai mốc', () => {
  it('khoảng bình thường', () => {
    expect(gioGiua('13:00', '18:00')).toBeCloseTo(5, 4)
    expect(gioGiua('06:53', '11:19')).toBeCloseTo(4.4333, 3)
  })

  it('ra < vào → trả số ÂM (để bộ phát hiện bất thường bắt được)', () => {
    // Dũng 16/08: cặp cuối "17:30" → "07:02" hôm sau
    expect(gioGiua('17:30', '07:02')).toBeLessThan(0)
  })

  it('mốc thiếu → null (không quy về 0)', () => {
    expect(gioGiua(null, '18:00')).toBeNull()
    expect(gioGiua('08:00', null)).toBeNull()
    expect(gioGiua('bậy', '18:00')).toBeNull()
  })
})
