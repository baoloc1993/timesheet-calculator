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

  it('một cặp PHỦ TRƯA (vào sáng, ra chiều) → cả ngày công, 0 OT, không cảnh báo', () => {
    // người dùng 2026-09-01: quên chấm trưa nhưng có mặt cả ngày → R=1, S=0.
    const r = tinhKetQuaNhanVien([dong('2026-08-10', ['06:00', '22:30'])], 8.1)
    expect(r[0].ngayCongR).toBe(1)
    expect(r[0].gioOtS).toBe(0)
    expect(r[0].mucDoCanhBao).toBe('none')
    expect(r[0].daSua).toBe(false)
    expect(r[0].capVaoRa).toEqual([{ vao: '06:00', ra: '22:30' }])
  })

  it('một cặp CHỈ MỘT BUỔI (chỉ chiều) → nửa công, 0 OT, không cảnh báo', () => {
    const r = tinhKetQuaNhanVien([dong('2026-08-10', ['13:12', '19:07'])], 8.1)
    expect(r[0].ngayCongR).toBe(0.5)
    expect(r[0].gioOtS).toBe(0)
    expect(r[0].mucDoCanhBao).toBe('none')
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

  it('một cặp liền 13h phủ trưa (07:00–20:00) → cả ngày công, 0 OT, không cảnh báo', () => {
    const r = tinhKetQuaNhanVien([dong('2026-08-10', ['07:00', '20:00'])], 8.1)
    expect(r[0].gioLamQ).toBeCloseTo(13, 4)
    expect(r[0].ngayCongR).toBe(1)
    expect(r[0].gioOtS).toBe(0)
    expect(r[0].mucDoCanhBao).toBe('none')
  })

  it('OT lớn nhưng chia HAI cặp rõ ràng → GIỮ OT, không ép, không cảnh báo', () => {
    // BacLan ngưỡng 6.1, 07:00-11:30 + 12:30-19:00 = 4.5 + 6.5 = 11h, OT thật 4.9h.
    // Có đủ 2 cặp → tính bình thường, không đụng luật "một cặp = nửa công".
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

// phản hồi dùng thật 2026-09-30 (người dùng, kỳ 09/2026): ngày 3 mốc bị đoán sai
// khe thiếu (luật cũ "khoảng hở dài nhất = nghỉ trưa") + điền mốc lấy nhầm giờ ra chiều của ngày
// chỉ một cặp. Ngày kề đủ 4 mốc để giờ quen/điền có căn cứ.
describe('vòng 10 pha E — ngày 3 mốc đoán đúng khe thiếu theo giờ quen', () => {
  const du4 = (ngay: string) => dong(ngay, ['07:00', '11:30', '13:30', '17:45'])
  const tinh = (moc: (string | null)[], nguong = 10.6) =>
    tinhKetQuaNhanVien([du4('2026-09-01'), dong('2026-09-02', moc), du4('2026-09-03')], nguong)[1]

  it.each([
    [['06:51', '11:39', '13:36'], 'thiếu giờ ra buổi chiều', [{ vao: '06:51', ra: '11:39' }, { vao: '13:36', ra: '17:45' }]],
    [['06:58', '10:58', '13:41'], 'thiếu giờ ra buổi chiều', [{ vao: '06:58', ra: '10:58' }, { vao: '13:41', ra: '17:45' }]],
    [['07:12', '12:47', '14:00'], 'thiếu giờ ra buổi chiều', [{ vao: '07:12', ra: '12:47' }, { vao: '14:00', ra: '17:45' }]],
    [['07:02', '13:37', '17:32'], 'thiếu giờ ra buổi sáng', [{ vao: '07:02', ra: '11:30' }, { vao: '13:37', ra: '17:32' }]],
    [['11:36', '13:29', '17:40'], 'thiếu giờ vào buổi sáng', [{ vao: '07:00', ra: '11:36' }, { vao: '13:29', ra: '17:40' }]]
  ])('%j → %s', (moc, ghiChu, cap) => {
    const r = tinh(moc as string[])
    expect(r.ghiChuSua).toContain(ghiChu)
    expect(r.capVaoRa).toEqual(cap)
    expect(r.ngayCongR).toBe(1)
    expect(r.gioOtS).toBe(0) // thiếu một lần chấm thật → vẫn ép OT = 0
  })

  it('điền mốc KHÔNG lấy giờ ra chiều của ngày trước chỉ chấm một cặp (ca 17:48)', () => {
    const r = tinhKetQuaNhanVien(
      [
        du4('2026-09-01'),
        dong('2026-09-02', ['07:05', '17:48']), // một cặp phủ trưa
        dong('2026-09-03', ['07:02', '13:37', '17:32'])
      ],
      10.6
    )[2]
    expect(r.capVaoRa[0]).toEqual({ vao: '07:02', ra: '11:30' })
    expect(r.ngayCongR).toBe(1)
  })

  it('Dũng 07/2026: hai ngày 3 mốc liền nhau không điền giờ vào chiều = giờ ra 18:02 của nhau', () => {
    const r = tinhKetQuaNhanVien(
      [
        du4('2026-07-08'),
        dong('2026-07-09', ['07:08', '11:32', '17:31']),
        dong('2026-07-10', ['07:05', '11:34', '18:02'])
      ],
      10.6
    )
    expect(r[1].capVaoRa[1]).toEqual({ vao: '13:30', ra: '17:31' })
    expect(r[2].capVaoRa[1]).toEqual({ vao: '13:30', ra: '18:02' })
    expect(r[1].ngayCongR).toBe(1)
    expect(r[2].ngayCongR).toBe(1)
  })

  it('máy đẩy giờ ra về sang cột cặp 3 (tổng 4 mốc) → 2 cặp bình thường, OT tính như thường', () => {
    const r = tinhKetQuaNhanVien([dong('2026-09-02', ['06:51', '11:39', '13:36', null, null, '19:00'])], 8.1)[0]
    expect(r.capVaoRa).toEqual([{ vao: '06:51', ra: '11:39' }, { vao: '13:36', ra: '19:00' }])
    expect(r.otBiEp).toBe(false)
    expect(r.gioOtS).toBeGreaterThan(0)
    expect(r.ghiChuSua).toContain('cột cặp 3')
    expect(r.ghiChuSua).not.toContain('máy ghi thêm')
  })

  it('lần chấm thứ 5 thật (cặp 3) → vẫn nhắc kiểm tay như cũ', () => {
    const r = tinhKetQuaNhanVien([dong('2026-08-10', ['07:06', '10:49', '13:19', '15:13', null, '15:45'])], 8.6)[0]
    expect(r.capVaoRa).toEqual([{ vao: '07:06', ra: '10:49' }, { vao: '13:19', ra: '15:13' }])
    expect(r.ghiChuSua).toContain('máy ghi thêm lần chấm 15:45 (cặp 3)')
  })
})
