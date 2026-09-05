// Vòng 3 — lưu kỳ + phát lương. Luồng tiền/dữ liệu: đóng băng dongBang, thực nhận, làm tròn.
import { describe, it, expect } from 'vitest'
import {
  lamTronNghin,
  tinhThucNhan,
  dongBangKetQuaKy,
  tongKetQuaKy,
  mergePhatLuongCu
} from '../../src/core/ketQuaKy'
import type { KetQuaKy } from '../../src/core/ketQuaKy'
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

  it('ranh giới 500đ: đúng 500 làm tròn LÊN (round nửa lên trên)', () => {
    // Câu hỏi "500 → ?" của phiên chính: Math.round(0.5) = 1 → 1.000đ
    expect(lamTronNghin(500)).toBe(1_000)
    expect(lamTronNghin(1_500)).toBe(2_000)
    expect(lamTronNghin(2_500)).toBe(3_000)
    expect(lamTronNghin(499)).toBe(0)
    expect(lamTronNghin(1_499)).toBe(1_000)
  })

  it('thành tiền lẻ tới hàng trăm/đồng vẫn tròn nghìn sạch', () => {
    expect(lamTronNghin(9_571_499.99)).toBe(9_571_000)
    expect(lamTronNghin(1_234_567.89)).toBe(1_235_000)
    expect(lamTronNghin(7_000_000.4)).toBe(7_000_000)
  })

  it('số âm: Math.round nửa hướng +∞ → −1.500 ra −1.000 (bất đối xứng có chủ đích)', () => {
    // Ghi lại hành vi thật cho trường hợp thực nhận âm (vay > lương).
    expect(lamTronNghin(-1_500)).toBe(-1_000)
    expect(lamTronNghin(-1_400)).toBe(-1_000)
    expect(lamTronNghin(-1_600)).toBe(-2_000)
    expect(lamTronNghin(-2_000)).toBe(-2_000)
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
  it('khấu trừ = 0 → thực nhận = làm tròn thành tiền', () => {
    expect(tinhThucNhan(6_543_210, 0)).toBe(6_543_000)
  })
  it('khấu trừ = thành tiền → thực nhận đúng 0đ (không âm, không lệch nghìn)', () => {
    expect(tinhThucNhan(7_000_000, 7_000_000)).toBe(0)
    expect(tinhThucNhan(6_543_210, 6_543_210)).toBe(0)
  })
  it('khấu trừ < thành tiền → phần còn lại, tròn nghìn', () => {
    expect(tinhThucNhan(6_543_210, 2_000_000)).toBe(4_543_000)
  })
  it('khấu trừ nhỉnh hơn thành tiền chút → thực nhận âm nhỏ', () => {
    expect(tinhThucNhan(6_000_000, 6_000_400) === 0).toBe(true) // −400 → 0 (kể cả −0)
    expect(tinhThucNhan(6_000_000, 6_001_500)).toBe(-1_000)
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
      soDongDaSua: 2,
      // Vòng 6 — đơn giá đóng băng cùng lúc (để S12/S13 giải trình công×giá).
      donGiaNgay: 0,
      donGiaGioOT: 0
    })
    expect(kq.khauTru).toEqual({})
    expect(kq.daTra).toEqual({})
    expect(kq.chuyenCan).toEqual({})
    expect(kq.buLuong).toEqual({})
    expect(kq.le).toEqual({})
    expect(kq.baoHiem).toEqual({})
  })

  it('đóng băng: sửa tongHop sau khi lưu KHÔNG đổi dongBang', () => {
    const kq = dongBangKetQuaKy(ky, tongHop, 'x')
    tongHop[0].thanhTien = 999
    tongHop[0].tongNgayCong = 1
    expect(kq.dongBang[0].thanhTien).toBe(7_000_000)
    expect(kq.dongBang[0].ngayCong).toBe(24)
  })

  it('mỗi dòng đóng băng là bản sao riêng — không dùng chung tham chiếu với TổngHợp', () => {
    const src = [th({ maNhanVien: '00001', tongNgayCong: 20, thanhTien: 5_000_000 })]
    const kq = dongBangKetQuaKy(ky, src, 'x')
    expect(kq.dongBang[0]).not.toBe(src[0])
  })

  it('lưu 2 kỳ khác nhau: kỳ lưu trước giữ nguyên số dù kỳ sau tính lại theo đơn giá mới', () => {
    // Mô phỏng: lưu kỳ 08 với đơn giá cũ, sau đó Setup tăng đơn giá → tính lại kỳ 09.
    const kyThang8 = { thang: '2026-08', ngayBatDau: '2026-08-01', ngayKetThuc: '2026-08-31' }
    const t8 = [th({ maNhanVien: '00015', tenBangLuong: 'Ông Dũng', tongNgayCong: 24, tongGioOT: 0, thanhTien: 24 * 300_000 })]
    const kq8 = dongBangKetQuaKy(kyThang8, t8, 'x')
    expect(kq8.dongBang[0].thanhTien).toBe(7_200_000)

    // Setup đổi đơn giá 300k → 350k, kỳ 09 dựng mới
    const kyThang9 = { thang: '2026-09', ngayBatDau: '2026-09-01', ngayKetThuc: '2026-09-30' }
    const t9 = [th({ maNhanVien: '00015', tenBangLuong: 'Ông Dũng', tongNgayCong: 24, tongGioOT: 0, thanhTien: 24 * 350_000 })]
    const kq9 = dongBangKetQuaKy(kyThang9, t9, 'y')

    expect(kq9.dongBang[0].thanhTien).toBe(8_400_000)
    expect(kq8.dongBang[0].thanhTien).toBe(7_200_000) // kỳ cũ KHÔNG đổi
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

  it('kỳ chưa ai được tick "đã trả" → đếm đủ số người chưa nhận', () => {
    const kq = {
      thang: '2026-09',
      ngayLuu: 'x',
      khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
      dongBang: [
        { maNhanVien: 'a', tenBangLuong: 'A', ngayCong: 20, gioOT: 0, thanhTien: 6_000_000, soDongDaSua: 0 },
        { maNhanVien: 'b', tenBangLuong: 'B', ngayCong: 22, gioOT: 5, thanhTien: 7_350_000, soDongDaSua: 1 },
        { maNhanVien: 'c', tenBangLuong: 'C', ngayCong: 18, gioOT: 0, thanhTien: 5_000_000, soDongDaSua: 0 }
      ],
      khauTru: {},
      daTra: {}
    }
    expect(tongKetQuaKy(kq).soNguoiChuaNhan).toBe(3)
  })

  it('tất cả đã trả → soNguoiChuaNhan = 0; daTra = false vẫn tính là chưa nhận', () => {
    const base = {
      thang: '2026-09',
      ngayLuu: 'x',
      khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
      dongBang: [
        { maNhanVien: 'a', tenBangLuong: 'A', ngayCong: 20, gioOT: 0, thanhTien: 6_000_000, soDongDaSua: 0 },
        { maNhanVien: 'b', tenBangLuong: 'B', ngayCong: 22, gioOT: 5, thanhTien: 7_350_000, soDongDaSua: 1 }
      ],
      khauTru: {}
    }
    expect(tongKetQuaKy({ ...base, daTra: { a: true, b: true } }).soNguoiChuaNhan).toBe(0)
    expect(tongKetQuaKy({ ...base, daTra: { a: true, b: false } }).soNguoiChuaNhan).toBe(1)
  })

  it('khấu trừ KHÔNG đụng Σ thành tiền gốc, chỉ đụng Σ thực nhận', () => {
    const kq = {
      thang: '2026-09',
      ngayLuu: 'x',
      khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
      dongBang: [
        { maNhanVien: 'a', tenBangLuong: 'A', ngayCong: 20, gioOT: 0, thanhTien: 6_000_000, soDongDaSua: 0 },
        { maNhanVien: 'b', tenBangLuong: 'B', ngayCong: 22, gioOT: 5, thanhTien: 7_000_000, soDongDaSua: 0 }
      ],
      khauTru: { a: 2_000_000, b: 3_000_000 },
      daTra: {}
    }
    const t = tongKetQuaKy(kq)
    expect(t.tongThanhTien).toBe(13_000_000) // gốc, không trừ
    expect(t.tongThucNhan).toBe(4_000_000 + 4_000_000)
  })

  it('kỳ rỗng (dongBang = []) → mọi Σ = 0, không chia cho 0, không NaN', () => {
    const kq = {
      thang: '2026-09',
      ngayLuu: 'x',
      khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
      dongBang: [],
      khauTru: {},
      daTra: {}
    }
    const t = tongKetQuaKy(kq)
    expect(t).toEqual({
      tongNgayCong: 0,
      tongGioOT: 0,
      tongThanhTien: 0,
      tongThucNhan: 0,
      soNguoiChuaNhan: 0
    })
  })

  it('ngày công / giờ OT lẻ cộng dồn không rơi vào rác dấu phẩy động', () => {
    const kq = {
      thang: '2026-09',
      ngayLuu: 'x',
      khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
      dongBang: [
        { maNhanVien: 'a', tenBangLuong: 'A', ngayCong: 20.5, gioOT: 3.3, thanhTien: 6_000_000, soDongDaSua: 0 },
        { maNhanVien: 'b', tenBangLuong: 'B', ngayCong: 21.5, gioOT: 4.4, thanhTien: 7_000_000, soDongDaSua: 0 }
      ],
      khauTru: {},
      daTra: {}
    }
    const t = tongKetQuaKy(kq)
    expect(t.tongNgayCong).toBe(42)
    expect(t.tongGioOT).toBe(7.7) // 3.3 + 4.4 = 7.699999… phải được gọt về 7.7
  })
})

describe('mergePhatLuongCu — ghi đè kỳ đã lưu (ca biên "gửi hai lần")', () => {
  const dong = (ma: string): KetQuaKy['dongBang'][number] => ({
    maNhanVien: ma,
    tenBangLuong: ma,
    ngayCong: 20,
    gioOT: 0,
    thanhTien: 5_000_000,
    soDongDaSua: 0
  })
  const ky = (dongBang: KetQuaKy['dongBang'], khauTru = {}, daTra = {}): KetQuaKy => ({
    thang: '2026-09',
    ngayLuu: 'x',
    khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
    dongBang,
    khauTru,
    daTra
  })

  it('kqCu = null → trả kqMoi nguyên vẹn', () => {
    const moi = ky([dong('a')])
    expect(mergePhatLuongCu(moi, null)).toBe(moi)
    expect(moi.khauTru).toEqual({})
  })

  it('mã còn trong kỳ mới → giữ khấu trừ + đã-trả cũ; mã biến mất → bỏ; mã mới → mặc định', () => {
    const cu = ky([dong('a'), dong('b')], { a: 500_000, b: 200_000 }, { a: true })
    const moi = ky([dong('a'), dong('c')]) // b rời kỳ, c mới vào
    mergePhatLuongCu(moi, cu)
    expect(moi.khauTru).toEqual({ a: 500_000 }) // a giữ, b bỏ, c không có
    expect(moi.daTra).toEqual({ a: true })
    expect(moi.khauTru.c).toBeUndefined()
  })
})
