import { describe, it, expect } from 'vitest'
import { gomMocCham } from '../../src/core/gomMocCham'
import type { MocChamTho } from '../../src/core/gomMocCham'
import { xuLyKyCong } from '../../src/core/xuLyKyCong'
import type { NhanVien } from '../../src/core/types'

// "máy trả về > 6 mốc chấm trong một ngày". Log máy: mỗi lần chạm vân tay một dòng,
// không có cấu trúc cặp sẵn — khác hẳn file Excel (đã có sẵn cột vào/ra).

const moc = (userId: string | number, isoLocal: string): MocChamTho => ({
  userId,
  timestamp: new Date(isoLocal)
})

describe('gomMocCham — ghép cặp + lọc khoảng ngày', () => {
  it('4 mốc trong ngày, gõ vào không theo thứ tự thời gian → sort rồi ghép cặp vào1/ra1/vào2/ra2', () => {
    const { file, canhBao } = gomMocCham(
      [
        moc('15', '2026-08-01T17:00:00'),
        moc('15', '2026-08-01T07:00:00'),
        moc('15', '2026-08-01T13:00:00'),
        moc('15', '2026-08-01T11:00:00')
      ],
      '2026-08-01',
      '2026-08-31'
    )
    expect(canhBao).toEqual([])
    expect(file.khoi).toHaveLength(1)
    expect(file.khoi[0].maNhanVien).toBe('00015') // chuanHoaMa: "15" → "00015"
    expect(file.khoi[0].dongNgay).toEqual([
      { ngay: '2026-08-01', thu: '', moc: ['07:00', '11:00', '13:00', '17:00', null, null], congMay: null, otMay: null }
    ])
  })

  it('lọc theo khoảng [tu, den] — mốc ngoài khoảng bị bỏ hoàn toàn, kể cả khi làm ngày đó lẻ mốc', () => {
    const { file } = gomMocCham(
      [moc(1, '2026-07-31T23:50:00'), moc(1, '2026-08-01T07:00:00'), moc(1, '2026-08-01T17:00:00')],
      '2026-08-01',
      '2026-08-31'
    )
    expect(file.khoi[0].dongNgay).toHaveLength(1)
    expect(file.khoi[0].dongNgay[0].moc).toEqual(['07:00', '17:00', null, null, null, null])
  })

  it('quá 6 mốc trong một ngày cho một người → giữ 3 cặp đầu, ghi cảnh báo, không throw', () => {
    const gio = ['06:00', '07:00', '11:00', '13:00', '17:00', '17:05', '20:00']
    const { file, canhBao } = gomMocCham(
      gio.map((g) => moc('00003', `2026-08-01T${g}:00`)),
      '2026-08-01',
      '2026-08-31'
    )
    expect(file.khoi[0].dongNgay[0].moc).toEqual(['06:00', '07:00', '11:00', '13:00', '17:00', '17:05'])
    expect(canhBao).toHaveLength(1)
    expect(canhBao[0]).toMatch(/00003 ngày 2026-08-01.*1 mốc dư/)
  })

  it('nhiều người, nhiều ngày → mỗi người một khối, ngày trong khối sắp tăng dần', () => {
    const { file } = gomMocCham(
      [
        moc('2', '2026-08-02T07:00:00'),
        moc('2', '2026-08-02T17:00:00'),
        moc('2', '2026-08-01T07:00:00'),
        moc('2', '2026-08-01T17:00:00'),
        moc('9', '2026-08-01T08:00:00'),
        moc('9', '2026-08-01T16:00:00')
      ],
      '2026-08-01',
      '2026-08-31'
    )
    expect(file.khoi.map((k) => k.maNhanVien)).toEqual(['00002', '00009'])
    expect(file.khoi[0].dongNgay.map((d) => d.ngay)).toEqual(['2026-08-01', '2026-08-02'])
  })

  it('không có mốc nào trong khoảng → khối rỗng, ngày/tháng suy từ tu/den', () => {
    const { file } = gomMocCham([], '2026-08-01', '2026-08-31')
    expect(file.khoi).toEqual([])
    expect(file.ngayBatDau).toBe('2026-08-01')
    expect(file.ngayKetThuc).toBe('2026-08-31')
    expect(file.thang).toBe('2026-08')
  })

  it('cùng một nhân viên nhưng máy trả nhiều dạng userId khác nhau ("2"/"02"/"00002") → gộp chung MỘT khối, không tách thành 3 người khác nhau', () => {
    const { file } = gomMocCham(
      [
        moc('2', '2026-08-01T07:00:00'),
        moc('2', '2026-08-01T17:00:00'),
        moc('02', '2026-08-02T07:00:00'),
        moc('02', '2026-08-02T17:00:00'),
        moc('00002', '2026-08-03T07:00:00'),
        moc('00002', '2026-08-03T17:00:00')
      ],
      '2026-08-01',
      '2026-08-31'
    )
    expect(file.khoi).toHaveLength(1)
    expect(file.khoi[0].maNhanVien).toBe('00002')
    expect(file.khoi[0].dongNgay.map((d) => d.ngay)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03'])
  })

  it('userId không có chữ số nào → chuanHoaMa giữ nguyên chuỗi (cùng quy ước docFileMay), không throw', () => {
    const { file } = gomMocCham([moc('abc', '2026-08-01T07:00:00')], '2026-08-01', '2026-08-31')
    expect(file.khoi.map((k) => k.maNhanVien)).toEqual(['abc'])
  })
})

describe('gomMocCham → xuLyKyCong (AC-2: đi thẳng vào luồng lõi, không có luồng tính công riêng)', () => {
  it('kết quả gom từ log máy tính Q/R/S giống hệt một ngày làm việc bình thường từ file Excel', () => {
    const { file } = gomMocCham(
      [
        moc('00007', '2026-08-01T07:00:00'),
        moc('00007', '2026-08-01T11:00:00'),
        moc('00007', '2026-08-01T13:00:00'),
        moc('00007', '2026-08-01T17:00:00')
      ],
      '2026-08-01',
      '2026-08-31'
    )
    const nv: NhanVien = {
      id: 'id-7',
      maNhanVien: '00007',
      tenMay: 'Máy 7',
      tenBangLuong: 'Ông 7',
      nguongGioChuanNgay: 8.1,
      donGiaNgay: 300000,
      donGiaGioOT: 60000,
      an: false
    }
    const ky = xuLyKyCong(file, [nv])
    expect(ky.thieuSetup).toEqual([])
    expect(ky.tongHop).toHaveLength(1)
    const [kq] = ky.tongHop[0].ketQuaNgay
    expect(kq.gioLamQ).toBe(8)
    expect(kq.ngayCongR).toBe(1)
    expect(kq.gioOtS).toBe(0)
    expect(kq.mucDoCanhBao).toBe('none')
  })

  it('userId của máy không khớp mã nào trong Setup → rơi vào thieuSetup (AC-6), không throw', () => {
    const { file } = gomMocCham(
      [moc('00099', '2026-08-01T07:00:00'), moc('00099', '2026-08-01T17:00:00')],
      '2026-08-01',
      '2026-08-31'
    )
    const ky = xuLyKyCong(file, [])
    expect(ky.thieuSetup).toEqual([{ maNhanVien: '00099', tenMay: '00099' }])
  })
})
