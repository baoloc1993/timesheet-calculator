import { describe, it, expect } from 'vitest'
import { tinhQ, tinhR, tinhS, tinhQRS } from '../../src/core/tinhQRS'

describe('tinhQ — giờ làm', () => {
  it('đủ 4 mốc: cộng hai cặp', () => {
    // My83 01/08: 06:53-11:19 + 13:34-18:05 = 8.95 (khớp công thức người dùng)
    expect(tinhQ([{ vao: '06:53', ra: '11:19' }, { vao: '13:34', ra: '18:05' }])).toBeCloseTo(8.95, 4)
  })
  it('chỉ cặp 1', () => {
    expect(tinhQ([{ vao: '07:06', ra: '17:05' }])).toBeCloseTo(9.9833, 3)
  })
  it('không có mốc → 0', () => {
    expect(tinhQ([])).toBe(0)
  })
  it('bỏ qua cặp 3 (khớp công thức tay)', () => {
    expect(
      tinhQ([{ vao: '07:00', ra: '11:00' }, { vao: '13:00', ra: '17:00' }, { vao: '18:00', ra: '20:00' }])
    ).toBeCloseTo(8, 4)
  })
})

describe('tinhR — ngày công', () => {
  it('Q=0 → 0', () => expect(tinhR(0)).toBe(0))
  it('Q<5.5 → 0.5', () => expect(tinhR(4.4)).toBe(0.5))
  it('Q=5.5 → 1', () => expect(tinhR(5.5)).toBe(1))
  it('Q lớn → 1', () => expect(tinhR(8.9)).toBe(1))
})

describe('tinhS — giờ OT theo ngưỡng riêng', () => {
  it('My83 ngưỡng 8.1: Q=8.95 → S=0.85', () => {
    expect(tinhS(8.95, 8.1)).toBeCloseTo(0.85, 4)
  })
  it('dưới ngưỡng+0.1 → 0', () => {
    expect(tinhS(8.15, 8.1)).toBe(0)
  })
  it('Dũng ngưỡng 10.6: Q=10.57 → 0', () => {
    expect(tinhS(10.5667, 10.6)).toBe(0)
  })
  it('ép OT về 0 khi dòng bị sửa', () => {
    expect(tinhS(12, 8.1, true)).toBe(0)
  })
})

describe('tinhQRS gộp', () => {
  it('ngày thường của Ly (ngưỡng 8.6)', () => {
    const r = tinhQRS([{ vao: '07:00', ra: '11:30' }, { vao: '13:00', ra: '18:00' }], 8.6)
    expect(r.Q).toBeCloseTo(9.5, 4)
    expect(r.R).toBe(1)
    expect(r.S).toBeCloseTo(0.9, 4)
  })
})

describe('tinhQ — cặp 3 và mốc lộn ngày', () => {
  it('có cặp 3 nhưng KHÔNG cộng vào Q', () => {
    const khong3 = tinhQ([{ vao: '07:00', ra: '11:00' }, { vao: '13:00', ra: '17:00' }])
    const co3 = tinhQ([
      { vao: '07:00', ra: '11:00' },
      { vao: '13:00', ra: '17:00' },
      { vao: '18:00', ra: '21:00' }
    ])
    expect(co3).toBeCloseTo(khong3, 4)
    expect(co3).toBeCloseTo(8, 4)
  })

  it('cặp có ra < vào (giờ lộn qua ngày) → Q âm, không bị kẹp về 0', () => {
    // Dũng 16/08 gốc: cặp cuối 17:30 → 07:02 → người dùng thấy Q âm rồi mới sửa
    const q = tinhQ([{ vao: '07:07', ra: '11:40' }, { vao: '17:30', ra: '07:02' }])
    expect(q).toBeLessThan(0)
  })
})

describe('tinhR — luôn ∈ {0, 0.5, 1}', () => {
  it('quét nhiều Q, không có giá trị R nào lạ', () => {
    for (let q = -3; q <= 20; q += 0.25) {
      expect([0, 0.5, 1]).toContain(tinhR(q))
    }
  })
  it('Q âm (mốc lộn ngày) → R = 0', () => {
    expect(tinhR(-5.9)).toBe(0)
  })
  it('biên Q = 5.5 → 1 (không phải 0.5)', () => {
    expect(tinhR(5.49)).toBe(0.5)
    expect(tinhR(5.5)).toBe(1)
  })
})

describe('tinhS — ngưỡng riêng từng người + biên +0.1', () => {
  it('BacLan ngưỡng 6.1: Q=8 → S=1.9', () => {
    expect(tinhS(8, 6.1)).toBeCloseTo(1.9, 4)
  })
  it('Dũng ngưỡng 10.6: Q=8.55 (ngày lộn đã sửa) → S=0', () => {
    expect(tinhS(8.55, 10.6)).toBe(0)
  })
  it('Q đúng bằng ngưỡng+0.1 → vẫn S=0 (điều kiện là > chặt)', () => {
    expect(tinhS(8.2, 8.1)).toBe(0)
    expect(tinhS(8.21, 8.1)).toBeCloseTo(0.11, 4)
  })
  it('epOtVe0 = true → S=0 bất kể Q lớn cỡ nào', () => {
    expect(tinhS(13.7, 8.1, true)).toBe(0)
  })
})
