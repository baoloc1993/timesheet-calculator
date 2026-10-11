import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { NhanVien } from '../../src/core/types'

// "Nạp từ file kỳ trước" trộn danh sách rút từ bảng lương vào Setup.
// Chỗ mất dữ liệu nếu sai: đè lên đơn giá / tên bảng lương người dùng đã khai tay, hoặc
// đẻ ra nhân viên trùng. Cô lập store qua TSC_CONFIG_DIR (như saoLuu.test.ts).

let tron: typeof import('../../src/main/settings/nhanVien').tronTuFileKyTruoc
let moStore: typeof import('../../src/main/settings/store').moStore
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tsc-tron-'))
  process.env.TSC_CONFIG_DIR = dir
  ;({ tronTuFileKyTruoc: tron } = await import('../../src/main/settings/nhanVien'))
  ;({ moStore } = await import('../../src/main/settings/store'))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function nv(over: Partial<NhanVien> & Pick<NhanVien, 'maNhanVien'>): NhanVien {
  return {
    id: 'seed-' + over.maNhanVien,
    tenMay: over.maNhanVien,
    tenBangLuong: '',
    nguongGioChuanNgay: 8.1,
    donGiaNgay: 0,
    donGiaGioOT: 0,
    an: false,
    ...over
  }
}

function seed(list: NhanVien[]): void {
  moStore().set('nhanVien', list)
}

beforeEach(() => seed([]))

describe('tronTuFileKyTruoc', () => {
  it('thẻ CÓ mã, mã mới → thêm nhân viên mới với đơn giá từ file', () => {
    seed([nv({ maNhanVien: '00002', tenBangLuong: 'Ông Hải', donGiaNgay: 350000, donGiaGioOT: 80000 })])

    const out = tron([{ maNhanVien: '00009', tenBangLuong: 'Chị Mới', donGiaNgay: 300000, donGiaGioOT: 60000 }])

    expect(out).toHaveLength(2)
    const moi = out.find((n) => n.maNhanVien === '00009')!
    expect(moi.tenBangLuong).toBe('Chị Mới')
    expect(moi.donGiaNgay).toBe(300000)
    expect(moi.donGiaGioOT).toBe(60000)
    expect(moi.id).toBeTruthy()
  })

  it('thẻ CÓ mã đã tồn tại → chỉ bổ sung ô trống, KHÔNG đè tên/đơn giá người dùng đã khai', () => {
    seed([nv({ maNhanVien: '00002', tenBangLuong: 'Ông Hải', donGiaNgay: 350000, donGiaGioOT: 80000 })])

    const out = tron([{ maNhanVien: '2', tenBangLuong: 'HẢI', donGiaNgay: 240000, donGiaGioOT: 70000 }])

    expect(out).toHaveLength(1) // không đẻ thêm bản ghi
    const cu = out[0]
    expect(cu.tenBangLuong).toBe('Ông Hải')
    expect(cu.donGiaNgay).toBe(350000)
    expect(cu.donGiaGioOT).toBe(80000)
  })

  it('thẻ CÓ mã đã tồn tại nhưng đơn giá đang trống → được bổ sung từ file', () => {
    seed([nv({ maNhanVien: '00002', tenBangLuong: '', donGiaNgay: 0, donGiaGioOT: 0 })])

    const out = tron([{ maNhanVien: '00002', tenBangLuong: 'Ông Hải', donGiaNgay: 240000, donGiaGioOT: 70000 }])

    expect(out).toHaveLength(1)
    expect(out[0].tenBangLuong).toBe('Ông Hải')
    expect(out[0].donGiaNgay).toBe(240000)
    expect(out[0].donGiaGioOT).toBe(70000)
  })

  it('thẻ KHÔNG mã, tên khớp người đã khai (khác hoa/thường + khoảng trắng thừa) → bổ sung đơn giá, KHÔNG tạo người mới', () => {
    seed([nv({ maNhanVien: '00003', tenBangLuong: 'Cô Mỹ', donGiaNgay: 0, donGiaGioOT: 0 })])

    const out = tron([{ tenBangLuong: '  cô   mỹ ', donGiaNgay: 240000, donGiaGioOT: 70000 }])

    expect(out).toHaveLength(1)
    expect(out[0].maNhanVien).toBe('00003')
    expect(out[0].donGiaNgay).toBe(240000)
    expect(out[0].donGiaGioOT).toBe(70000)
  })

  it('thẻ KHÔNG mã, tên không khớp ai → bỏ qua (không thêm, không ném lỗi)', () => {
    seed([nv({ maNhanVien: '00003', tenBangLuong: 'Cô Mỹ', donGiaNgay: 240000, donGiaGioOT: 70000 })])

    const out = tron([{ tenBangLuong: 'Người Lạ Hoắc', donGiaNgay: 999000, donGiaGioOT: 99000 }])

    expect(out).toHaveLength(1)
    expect(out[0].tenBangLuong).toBe('Cô Mỹ')
    expect(out[0].donGiaNgay).toBe(240000)
  })

  it('trộn hỗn hợp nhiều thẻ trong một lần gọi → mỗi thẻ xử đúng nhánh của nó', () => {
    seed([
      nv({ maNhanVien: '00002', tenBangLuong: 'Ông Hải', donGiaNgay: 350000, donGiaGioOT: 80000 }),
      nv({ maNhanVien: '00003', tenBangLuong: 'Cô Mỹ', donGiaNgay: 0, donGiaGioOT: 0 })
    ])

    const out = tron([
      { maNhanVien: '00002', tenBangLuong: 'HẢI', donGiaNgay: 240000, donGiaGioOT: 70000 }, // đã có → giữ nguyên
      { tenBangLuong: 'cô mỹ', donGiaNgay: 240000, donGiaGioOT: 70000 }, // khớp tên → bổ sung
      { maNhanVien: '00010', tenBangLuong: 'Người Mới', donGiaNgay: 260000, donGiaGioOT: 50000 } // mã mới → thêm
    ])

    expect(out).toHaveLength(3)
    expect(out.find((n) => n.maNhanVien === '00002')!.donGiaNgay).toBe(350000)
    expect(out.find((n) => n.maNhanVien === '00003')!.donGiaNgay).toBe(240000)
    expect(out.find((n) => n.maNhanVien === '00010')!.tenBangLuong).toBe('Người Mới')
  })
})
