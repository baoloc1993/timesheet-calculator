// Chuyên cần tự tính theo ngày công (người dùng chốt qua chat 2026-10-01) — luồng tiền.
import { describe, it, expect } from 'vitest'
import {
  tinhChuyenCan,
  chuyenCanCua,
  coChuyenCanTuDong,
  mergePhatLuongCu,
  chuyenCanLaSoTay,
  mapChuyenCan,
  tongKetQuaKy
} from '../../src/core/ketQuaKy'
import type { KetQuaKy } from '../../src/core/ketQuaKy'

function ky(over: Partial<KetQuaKy> = {}): KetQuaKy {
  return {
    thang: '2026-09',
    ngayLuu: 'x',
    khoangNgay: { tu: '2026-09-01', den: '2026-09-30' },
    dongBang: [
      { maNhanVien: 'A', tenBangLuong: 'A', ngayCong: 28, gioOT: 0, thanhTien: 1000000, soDongDaSua: 0 },
      { maNhanVien: 'B', tenBangLuong: 'B', ngayCong: 26.5, gioOT: 0, thanhTien: 1000000, soDongDaSua: 0 }
    ],
    khauTru: {},
    daTra: {},
    chuyenCan: {},
    ...over
  }
}

describe('tinhChuyenCan', () => {
  it('dưới 27 công = 0, 27 = 100k, mỗi nửa công thêm +50k', () => {
    expect(tinhChuyenCan(26.9)).toBe(0)
    expect(tinhChuyenCan(27)).toBe(100000)
    expect(tinhChuyenCan(27.3)).toBe(100000)
    expect(tinhChuyenCan(27.5)).toBe(150000)
    expect(tinhChuyenCan(28)).toBe(200000)
    expect(tinhChuyenCan(29.5)).toBe(350000)
    expect(tinhChuyenCan(NaN)).toBe(0)
  })
})

describe('chuyenCanCua', () => {
  it('chưa nhập tay → tự tính; gõ tay (kể cả 0, có cờ) → giữ số tay', () => {
    const kq = ky({ chuyenCanTuDong: true, chuyenCan: { B: 0 } })
    expect(chuyenCanCua(kq, kq.dongBang[0])).toBe(200000)
    const kq2 = ky({ chuyenCanTuDong: true, chuyenCan: { A: 0 }, chuyenCanSuaTay: { A: true } })
    expect(chuyenCanCua(kq2, kq2.dongBang[0])).toBe(0)
    expect(mapChuyenCan(kq)).toEqual({ A: 200000, B: 0 })
  })

  it('số 0 do bản cũ tự ghi khi bấm qua ô (không cờ) → vẫn tự tính; số > 0 cũ → giữ', () => {
    const kq = ky({ chuyenCan: { A: 0 } })
    expect(chuyenCanLaSoTay(kq, 'A')).toBe(false)
    expect(chuyenCanCua(kq, kq.dongBang[0])).toBe(200000)
    const kq2 = ky({ chuyenCan: { A: 150000 } })
    expect(chuyenCanCua(kq2, kq2.dongBang[0])).toBe(150000)
  })

  it('lưu lại kỳ giữ cờ sửa tay của mã còn trong kỳ', () => {
    const moi = mergePhatLuongCu(ky({ chuyenCanTuDong: true }), ky({ chuyenCan: { A: 0 }, chuyenCanSuaTay: { A: true, X: true } }))
    expect(moi.chuyenCanSuaTay).toEqual({ A: true })
    expect(chuyenCanCua(moi, moi.dongBang[0])).toBe(0)
  })

  it('kỳ cũ (thiếu cờ) đã phát cho ai đó → không tự tính, giữ thực nhận lịch sử', () => {
    const kq = ky({ daTra: { B: true } })
    expect(coChuyenCanTuDong(kq)).toBe(false)
    expect(chuyenCanCua(kq, kq.dongBang[0])).toBe(0)
    expect(tongKetQuaKy(kq).tongThucNhan).toBe(2000000)
  })

  it('kỳ cũ chưa phát ai → tự tính', () => {
    const kq = ky()
    expect(coChuyenCanTuDong(kq)).toBe(true)
    expect(tongKetQuaKy(kq).tongThucNhan).toBe(2200000)
  })

  it('lưu lại kỳ giữ cờ của kỳ cũ', () => {
    const moi = ky({ chuyenCanTuDong: true })
    expect(mergePhatLuongCu(moi, ky({ daTra: { A: true } })).chuyenCanTuDong).toBe(false)
    expect(mergePhatLuongCu(ky({ chuyenCanTuDong: true }), ky({ chuyenCanTuDong: true, daTra: { A: true } })).chuyenCanTuDong).toBe(true)
  })
})
