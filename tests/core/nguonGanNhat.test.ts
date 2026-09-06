import { describe, it, expect } from 'vitest'
import { chuanHoaNguonGanNhat } from '../../src/core/nguonGanNhat'

// thành công gần nhất, dùng để tự chạy lại khi mở app. Field lạ/thiếu/hỏng → null,
// không throw (cùng cơ chế chuanHoaHienThi/chuanHoaCauHinhMay).

describe('chuanHoaNguonGanNhat', () => {
  it('undefined/null/không phải object → null', () => {
    expect(chuanHoaNguonGanNhat(undefined)).toBeNull()
    expect(chuanHoaNguonGanNhat(null)).toBeNull()
    expect(chuanHoaNguonGanNhat('file')).toBeNull()
    expect(chuanHoaNguonGanNhat(42)).toBeNull()
  })

  it('object rỗng hoặc loai lạ → null', () => {
    expect(chuanHoaNguonGanNhat({})).toBeNull()
    expect(chuanHoaNguonGanNhat({ loai: 'khac', duongDan: 'C:/a.xlsx' })).toBeNull()
  })

  it('loai file hợp lệ → giữ nguyên', () => {
    expect(chuanHoaNguonGanNhat({ loai: 'file', duongDan: 'C:/du-lieu/thang-9.dat' })).toEqual({
      loai: 'file',
      duongDan: 'C:/du-lieu/thang-9.dat'
    })
  })

  it('loai file, duongDan rỗng → null', () => {
    expect(chuanHoaNguonGanNhat({ loai: 'file', duongDan: '' })).toBeNull()
  })

  it('loai file, duongDan chỉ toàn khoảng trắng → null', () => {
    expect(chuanHoaNguonGanNhat({ loai: 'file', duongDan: '   ' })).toBeNull()
  })

  it('loai may hợp lệ → giữ nguyên', () => {
    expect(chuanHoaNguonGanNhat({ loai: 'may', ip: '1.2.3.4', port: 4370 })).toEqual({
      loai: 'may',
      ip: '1.2.3.4',
      port: 4370
    })
  })

  it('loai may, ip rỗng → null', () => {
    expect(chuanHoaNguonGanNhat({ loai: 'may', ip: '', port: 4370 })).toBeNull()
  })

  it('loai may, port ngoài khoảng 1–65535 → null', () => {
    expect(chuanHoaNguonGanNhat({ loai: 'may', ip: '1.2.3.4', port: 0 })).toBeNull()
    expect(chuanHoaNguonGanNhat({ loai: 'may', ip: '1.2.3.4', port: 70000 })).toBeNull()
  })

  it('loai may, port không phải số nguyên → null', () => {
    expect(chuanHoaNguonGanNhat({ loai: 'may', ip: '1.2.3.4', port: 4370.5 })).toBeNull()
    expect(chuanHoaNguonGanNhat({ loai: 'may', ip: '1.2.3.4', port: '4370' })).toBeNull()
  })
})
