import { describe, it, expect } from 'vitest'
import { ipHopLe, congHopLe, chuanHoaCauHinhMay, MAC_DINH_CAU_HINH_MAY } from '../../src/core/mayChamCong'

// ("validate cơ bản: IP đúng dạng IPv4, cổng là số 1–65535").

describe('ipHopLe', () => {
  it('IPv4 hợp lệ', () => {
    expect(ipHopLe('192.0.2.201')).toBe(true)
    expect(ipHopLe('0.0.0.0')).toBe(true)
    expect(ipHopLe('255.255.255.255')).toBe(true)
  })

  it('sai dạng → false', () => {
    expect(ipHopLe('')).toBe(false)
    expect(ipHopLe('không phải ip')).toBe(false)
    expect(ipHopLe('192.168.1')).toBe(false)
    expect(ipHopLe('192.0.2.1.1')).toBe(false)
    expect(ipHopLe('192.0.2.256')).toBe(false)
    expect(ipHopLe('192.168.a.1')).toBe(false)
  })
})

describe('congHopLe', () => {
  it('1–65535 → true', () => {
    expect(congHopLe(1)).toBe(true)
    expect(congHopLe(4970)).toBe(true)
    expect(congHopLe(65535)).toBe(true)
  })

  it('ngoài khoảng / không phải số nguyên → false', () => {
    expect(congHopLe(0)).toBe(false)
    expect(congHopLe(65536)).toBe(false)
    expect(congHopLe(-1)).toBe(false)
    expect(congHopLe(4970.5)).toBe(false)
    expect(congHopLe(NaN)).toBe(false)
  })
})

describe('chuanHoaCauHinhMay', () => {
  it('undefined/null → mặc định (ip rỗng, cổng 4970)', () => {
    expect(chuanHoaCauHinhMay(undefined)).toEqual(MAC_DINH_CAU_HINH_MAY)
    expect(chuanHoaCauHinhMay(null)).toEqual(MAC_DINH_CAU_HINH_MAY)
  })

  it('giá trị hợp lệ → giữ nguyên', () => {
    expect(chuanHoaCauHinhMay({ ip: '10.0.0.5', port: 4370 })).toEqual({ ip: '10.0.0.5', port: 4370 })
  })

  it('cổng hỏng (config.json bị sửa tay) → về mặc định 4970, không throw, IP hợp lệ vẫn giữ', () => {
    expect(chuanHoaCauHinhMay({ ip: '10.0.0.5', port: 99999 as unknown as number })).toEqual({
      ip: '10.0.0.5',
      port: 4970
    })
  })

  it('ip khoảng trắng được trim', () => {
    expect(chuanHoaCauHinhMay({ ip: '  10.0.0.5  ', port: 4970 })).toEqual({ ip: '10.0.0.5', port: 4970 })
  })
})
