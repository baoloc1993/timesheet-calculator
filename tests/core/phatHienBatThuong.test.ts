import { describe, it, expect } from 'vitest'
import { tinhKetQuaNhanVien } from '../../src/core/phatHienBatThuong'
import type { DongNgayMay } from '../../src/core/types'

function dong(ngay: string, moc: (string | null)[]): DongNgayMay {
  return { ngay, thu: '', moc: [...moc, null, null, null, null, null, null].slice(0, 6), congMay: null, otMay: null }
}

describe('phát hiện + tự sửa dòng bất thường', () => {
  it('nghỉ cả ngày (không mốc) → KHÔNG cảnh báo', () => {
    const r = tinhKetQuaNhanVien([dong('2026-08-23', [])], 10.6)
    expect(r[0].mucDoCanhBao).toBe('none')
    expect(r[0].ngayCongR).toBe(0)
    expect(r[0].daSua).toBe(false)
  })

  it('Dũng 16/08: giờ ra lộn sang hôm sau → bỏ 07:02, điền Vào2 theo ngày kề, ép OT=0', () => {
    const r = tinhKetQuaNhanVien(
      [
        dong('2026-08-15', ['06:58', '11:38', '13:30', '17:32']),
        dong('2026-08-16', ['07:07', '11:40', '17:30', '07:02']),
        dong('2026-08-18', ['07:06', '11:36', '13:30', '17:40'])
      ],
      10.6
    )
    const d16 = r[1]
    expect(d16.mucDoCanhBao).toBe('vang')
    expect(d16.gioOtS).toBe(0)
    // 07:02 bị bỏ; còn 07:07, 11:40, 17:30 → Vào2 điền theo ngày kề (13:30)
    expect(d16.capVaoRa[0]).toEqual({ vao: '07:07', ra: '11:40' })
    expect(d16.capVaoRa[1].ra).toBe('17:30')
    expect(d16.capVaoRa[1].vao).toBe('13:30')
  })

  it('một ca liền quá dài (>14h) → giữ ngày công, ép OT=0', () => {
    const r = tinhKetQuaNhanVien([dong('2026-08-10', ['06:00', '22:30'])], 8.1)
    expect(r[0].ngayCongR).toBe(1)
    expect(r[0].gioOtS).toBe(0)
    expect(r[0].mucDoCanhBao).toBe('vang')
  })

  it('ngày thường đủ 4 mốc → không cảnh báo, OT theo công thức', () => {
    const r = tinhKetQuaNhanVien([dong('2026-08-01', ['06:53', '11:19', '13:34', '18:05'])], 8.1)
    expect(r[0].mucDoCanhBao).toBe('none')
    expect(r[0].gioOtS).toBeCloseTo(0.85, 2)
  })

  it('chỉ có giờ vào buổi sáng → điền giờ ra theo ngày kề, ép OT=0', () => {
    const r = tinhKetQuaNhanVien(
      [
        dong('2026-08-04', ['07:00', '11:30', '13:30', '17:30']),
        dong('2026-08-05', ['07:10', null, null, null])
      ],
      8.1
    )
    expect(r[1].mucDoCanhBao).toBe('vang')
    expect(r[1].gioOtS).toBe(0)
    expect(r[1].capVaoRa[0].vao).toBe('07:10')
    expect(r[1].capVaoRa[0].ra).toBe('11:30') // theo ngày trước
  })

  it('thiếu mốc ở dòng ĐẦU (không có ngày trước) → điền theo ngày liền SAU', () => {
    const r = tinhKetQuaNhanVien(
      [
        dong('2026-08-01', ['07:00', null, null, null]),
        dong('2026-08-02', ['06:50', '11:35', '13:30', '17:40'])
      ],
      8.1
    )
    expect(r[0].mucDoCanhBao).toBe('vang')
    expect(r[0].gioOtS).toBe(0)
    expect(r[0].capVaoRa[0].vao).toBe('07:00')
    expect(r[0].capVaoRa[0].ra).toBe('11:35') // lấy Ra1 của ngày liền sau
    expect(r[0].ghiChuSua).not.toBe('')
  })

  it('S thô > 4 trên MỘT cặp liền → ép OT = 0 (nghi quên chấm nghỉ trưa)', () => {
    // 07:00→20:00 = 13h, dưới ngưỡng "ca dài" 14h nên chỉ luật S>4 kích hoạt
    const r = tinhKetQuaNhanVien([dong('2026-08-10', ['07:00', '20:00'])], 8.1)
    expect(r[0].gioLamQ).toBeCloseTo(13, 4)
    expect(r[0].ngayCongR).toBe(1)
    expect(r[0].gioOtS).toBe(0)
    expect(r[0].mucDoCanhBao).toBe('vang')
  })

  it('OT lớn nhưng chia HAI cặp rõ ràng → GIỮ OT, không ép, không cảnh báo', () => {
    // BacLan ngưỡng 6.1, 07:00-11:30 + 12:30-19:00 = 4.5 + 6.5 = 11h, S thô 4.9 > 4
    // nhưng có 2 cặp → luật "S>4 & 1 cặp" KHÔNG áp → tránh xoá nhầm tiền OT thật
    const r = tinhKetQuaNhanVien([dong('2026-08-12', ['07:00', '11:30', '12:30', '19:00'])], 6.1)
    expect(r[0].gioLamQ).toBeCloseTo(11, 4)
    expect(r[0].gioOtS).toBeCloseTo(4.9, 4)
    expect(r[0].mucDoCanhBao).toBe('none')
    expect(r[0].daSua).toBe(false)
  })

  it('nghỉ cả ngày ở GIỮA chuỗi ngày có công → vẫn không cảnh báo, không kéo giờ ngày kề', () => {
    const r = tinhKetQuaNhanVien(
      [
        dong('2026-08-04', ['07:00', '11:30', '13:30', '17:30']),
        dong('2026-08-05', []),
        dong('2026-08-06', ['07:00', '11:30', '13:30', '17:30'])
      ],
      8.1
    )
    expect(r[1].mucDoCanhBao).toBe('none')
    expect(r[1].gioLamQ).toBe(0)
    expect(r[1].ngayCongR).toBe(0)
    expect(r[1].gioOtS).toBe(0)
    expect(r[1].daSua).toBe(false)
    expect(r[1].capVaoRa).toEqual([])
  })

  it('bất biến: dòng daSua thì ghiChuSua không rỗng; dòng none thì rỗng', () => {
    const r = tinhKetQuaNhanVien(
      [
        dong('2026-08-15', ['06:58', '11:38', '13:30', '17:32']),
        dong('2026-08-16', ['07:07', '11:40', '17:30', '07:02']),
        dong('2026-08-17', []),
        dong('2026-08-18', ['07:06', '11:36', '13:30', '17:40'])
      ],
      10.6
    )
    for (const d of r) {
      if (d.daSua) expect(d.ghiChuSua).not.toBe('')
      else expect(d.ghiChuSua).toBe('')
      expect([0, 0.5, 1]).toContain(d.ngayCongR)
      expect(d.gioOtS).toBeGreaterThanOrEqual(0)
    }
  })
})
