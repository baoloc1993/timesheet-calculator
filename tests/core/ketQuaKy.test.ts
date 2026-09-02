// Vòng 3 — lưu kỳ + phát lương. Luồng tiền/dữ liệu: đóng băng dongBang, thực nhận, làm tròn.
import { describe, it, expect } from 'vitest'
import {
  lamTronNghin,
  tinhThucNhan,
  dongBangKetQuaKy,
  tongKetQuaKy
} from '../../src/core/ketQuaKy'
import type { TongHopNhanVien } from '../../src/core/types'

function th(o: Partial<TongHopNhanVien> & Pick<TongHopNhanVien, 'maNhanVien'>): TongHopNhanVien {
  return {
    tenMay: o.maNhanVien,
    tenBangLuong: o.maNhanVien,
    nguongGioChuanNgay: 8.1,
    donGiaNgay: 0,
    donGiaGioOT: 0,
    tongNgayCong: 0,
    tongGioOT: 0,
    soDongCanXemLai: 0,
    thanhTien: 0,
    ketQuaNgay: [],
    ...o
  }
}

describe('lamTronNghin', () => {
  it('làm tròn thường đến 1.000đ', () => {
    expect(lamTronNghin(9_571_900)).toBe(9_572_000)
    expect(lamTronNghin(9_571_400)).toBe(9_571_000)
    expect(lamTronNghin(9_571_500)).toBe(9_572_000)
    expect(lamTronNghin(0)).toBe(0)
  })
})

describe('tinhThucNhan', () => {
  it('thành tiền − khấu trừ, làm tròn nghìn', () => {
    expect(tinhThucNhan(9_571_900, 500_000)).toBe(9_072_000)
    expect(tinhThucNhan(9_571_900, 0)).toBe(9_572_000)
  })
  it('cho phép âm khi vay > lương', () => {
    expect(tinhThucNhan(5_000_000, 8_000_000)).toBe(-3_000_000)
  })
  it('khấu trừ không phải số → coi như 0', () => {
    expect(tinhThucNhan(1_000_000, NaN)).toBe(1_000_000)
  })
})

describe('dongBangKetQuaKy', () => {
  const ky = { thang: '2026-09', ngayBatDau: '2026-09-01', ngayKetThuc: '2026-09-30' }
  const tongHop = [
    th({ maNhanVien: '00015', tenBangLuong: 'Ông Dũng', tongNgayCong: 24, tongGioOT: 10, thanhTien: 7_000_000, soDongCanXemLai: 2 })
  ]

  it('chụp dongBang + khoảng ngày, khấu trừ/đã-trả rỗng', () => {
    const kq = dongBangKetQuaKy(ky, tongHop, '2026-10-01T02:00:00.000Z')
    expect(kq.thang).toBe('2026-09')
    expect(kq.khoangNgay).toEqual({ tu: '2026-09-01', den: '2026-09-30' })
    expect(kq.dongBang[0]).toEqual({
      maNhanVien: '00015',
      tenBangLuong: 'Ông Dũng',
      ngayCong: 24,
      gioOT: 10,
      thanhTien: 7_000_000,
      soDongDaSua: 2
    })
    expect(kq.khauTru).toEqual({})
    expect(kq.daTra).toEqual({})
  })

  it('đóng băng: sửa tongHop sau khi lưu KHÔNG đổi dongBang', () => {
    const kq = dongBangKetQuaKy(ky, tongHop, 'x')
    tongHop[0].thanhTien = 999
    tongHop[0].tongNgayCong = 1
    expect(kq.dongBang[0].thanhTien).toBe(7_000_000)
    expect(kq.dongBang[0].ngayCong).toBe(24)
  })
})

describe('tongKetQuaKy', () => {
  it('Σ thực nhận + đếm người chưa nhận từ dongBang đóng băng', () => {
    const kq = {
      thang: '2026-09',
      ngayLuu: 'x',
      khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
      dongBang: [
        { maNhanVien: 'a', tenBangLuong: 'A', ngayCong: 20, gioOT: 0, thanhTien: 6_000_000, soDongDaSua: 0 },
        { maNhanVien: 'b', tenBangLuong: 'B', ngayCong: 22, gioOT: 5, thanhTien: 7_350_000, soDongDaSua: 1 }
      ],
      khauTru: { a: 1_000_000 },
      daTra: { a: true }
    }
    const t = tongKetQuaKy(kq)
    expect(t.tongThanhTien).toBe(13_350_000)
    expect(t.tongThucNhan).toBe(5_000_000 + 7_350_000)
    expect(t.soNguoiChuaNhan).toBe(1) // chỉ b chưa nhận
    expect(t.tongNgayCong).toBe(42)
    expect(t.tongGioOT).toBe(5)
  })
})
