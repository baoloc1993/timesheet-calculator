import { describe, it, expect } from 'vitest'
import { chuanHoaHienThi, MAC_DINH_HIEN_THI } from '../../src/core/hienThi'

// thiếu/hỏng field phải về mặc định tại code, không throw.

describe('chuanHoaHienThi', () => {
  it('undefined/null → mặc định', () => {
    expect(chuanHoaHienThi(undefined)).toEqual(MAC_DINH_HIEN_THI)
    expect(chuanHoaHienThi(null)).toEqual(MAC_DINH_HIEN_THI)
  })

  it('rỗng {} → mặc định từng field', () => {
    expect(chuanHoaHienThi({})).toEqual(MAC_DINH_HIEN_THI)
  })

  it('giá trị hợp lệ → giữ nguyên', () => {
    expect(chuanHoaHienThi({ scale: 1.3, rowHeight: 64, theme: 'dark', contrast: 'high' })).toEqual({
      scale: 1.3,
      rowHeight: 64,
      theme: 'dark',
      contrast: 'high'
    })
  })

  it('giá trị lạ (config.json cũ bị sửa tay / bản sau hạ cấp) → về mặc định field đó, không throw', () => {
    expect(
      chuanHoaHienThi({
        scale: 2 as unknown as 1,
        rowHeight: 100 as unknown as 42,
        theme: 'purple' as unknown as 'light',
        contrast: 'medium' as unknown as 'high'
      })
    ).toEqual(MAC_DINH_HIEN_THI)
  })

  it('chỉ ghi đè field có mặt, giữ mặc định các field còn lại', () => {
    expect(chuanHoaHienThi({ theme: 'light' })).toEqual({ ...MAC_DINH_HIEN_THI, theme: 'light' })
  })
})
