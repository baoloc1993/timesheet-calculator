// toàn vẹn dữ liệu config.json khi ghi/đọc AppConfig.hienThi qua src/main/settings/store.ts.
// dòng "đổi thiết lập Hiển thị ... không mất dữ liệu".
// Cô lập store qua TSC_CONFIG_DIR + vi.resetModules() (mẫu tronTuFileKyTruoc.test.ts) — mỗi
// test cần một `config.json` khởi tạo khác nhau, mà store.ts giữ singleton module-level.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { MAC_DINH_HIEN_THI } from '../../src/core/hienThi'
import type { NhanVien } from '../../src/core/types'
import type { KetQuaKy } from '../../src/core/ketQuaKy'

let dir: string
const cfgPath = () => join(dir, 'config.json')

afterEach(() => {
  delete process.env.TSC_CONFIG_DIR
  if (dir) rmSync(dir, { recursive: true, force: true })
})

/** Nạp module store.ts "sạch" (chưa mở store lần nào) trỏ vào `dir` cho trước. */
async function moStoreMoi(d: string) {
  dir = d
  process.env.TSC_CONFIG_DIR = dir
  vi.resetModules()
  return import('../../src/main/settings/store')
}

const nv = (maNhanVien: string): NhanVien => ({
  id: 'seed-' + maNhanVien,
  maNhanVien,
  tenMay: 'Máy ' + maNhanVien,
  tenBangLuong: 'Ông ' + maNhanVien,
  nguongGioChuanNgay: 8.1,
  donGiaNgay: 300000,
  donGiaGioOT: 60000,
  an: false
})

const kyMau: KetQuaKy = {
  thang: '2026-08',
  ngayLuu: '2026-08-31T00:00:00.000Z',
  khoangNgay: { tu: '2026-08-01', den: '2026-08-31' },
  dongBang: [
    { maNhanVien: '00002', tenBangLuong: 'Ông 00002', ngayCong: 24, gioOT: 10, thanhTien: 7_000_000, soDongDaSua: 0 }
  ],
  khauTru: { '00002': 200_000 },
  daTra: { '00002': true }
}

describe('layHienThi — config cũ (bản 0.3.0, chưa có field hienThi)', () => {
  it('đọc config không có hienThi → trả mặc định, không throw', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-hienthi-cu-'))
    writeFileSync(
      join(d, 'config.json'),
      JSON.stringify({
        nhanVien: [nv('00002')],
        appConfig: {
          schemaVersion: 2, // bản 0.3.0 = vòng 3, chưa có hienThi
          thuMucXuatGanNhat: 'D:\\xuat',
          fileMauBangLuongGanNhat: '',
          kyXuLyGanNhat: '2026-08'
        },
        ketQuaKy: { '2026-08': kyMau }
      })
    )
    const { layHienThi } = await moStoreMoi(d)

    expect(() => layHienThi()).not.toThrow()
    expect(layHienThi()).toEqual(MAC_DINH_HIEN_THI)
  })

  it('config có hienThi rỗng {} (ghi tay/hỏng một phần) → vẫn trả mặc định, không throw', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-hienthi-rong-'))
    writeFileSync(
      join(d, 'config.json'),
      JSON.stringify({
        nhanVien: [],
        appConfig: { schemaVersion: 2, thuMucXuatGanNhat: '', fileMauBangLuongGanNhat: '', kyXuLyGanNhat: '', hienThi: {} },
        ketQuaKy: {}
      })
    )
    const { layHienThi } = await moStoreMoi(d)
    expect(layHienThi()).toEqual(MAC_DINH_HIEN_THI)
  })
})

describe('ghiHienThi — chặn giá trị ngoài tập hợp lệ, không ghi bừa vào config.json', () => {
  it('scale/theme ngoài enum → ghi xuống đĩa vẫn là giá trị hợp lệ (mặc định), không lưu nguyên văn giá trị lạ', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-hienthi-invalid-'))
    const { ghiHienThi } = await moStoreMoi(d)

    const ket = ghiHienThi({
      scale: 999 as unknown as 1,
      rowHeight: -5 as unknown as 42,
      theme: 'purple' as unknown as 'light',
      contrast: 'medium' as unknown as 'high'
    })

    expect(ket).toEqual(MAC_DINH_HIEN_THI)

    // Đọc thẳng file trên đĩa — đúng tinh thần "không ghi bừa", không chỉ tin bộ nhớ.
    const raw = JSON.parse(readFileSync(cfgPath(), 'utf8'))
    expect(raw.appConfig.hienThi).toEqual(MAC_DINH_HIEN_THI)
  })

  it('patch một field hợp lệ rồi patch tiếp một field khác với giá trị lạ → field hợp lệ trước đó KHÔNG bị cuốn theo về mặc định', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-hienthi-giupatch-'))
    const { ghiHienThi, layHienThi } = await moStoreMoi(d)

    ghiHienThi({ scale: 1.3 })
    expect(layHienThi().scale).toBe(1.3)

    const ket = ghiHienThi({ theme: 'khong-ton-tai' as unknown as 'light' })

    expect(ket.scale).toBe(1.3) // giá trị hợp lệ đã lưu trước đó không bị xoá
    expect(ket.theme).toBe('auto') // field lạ về mặc định của riêng nó

    const raw = JSON.parse(readFileSync(cfgPath(), 'utf8'))
    expect(raw.appConfig.hienThi.scale).toBe(1.3)
    expect(raw.appConfig.hienThi.theme).toBe('auto')
  })
})

describe('ghiHienThi — round-trip, không đụng phần còn lại của config.json', () => {
  it('ghi hienThi không đổi NhanVien / KetQuaKy / các field AppConfig khác', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-hienthi-roundtrip-'))
    const { moStore, ghiHienThi, layNhanVien, layDanhSachKy, layConfig } = await moStoreMoi(d)

    const s = moStore()
    s.set('nhanVien', [nv('00002'), nv('00003')])
    s.set('ketQuaKy', { '2026-08': kyMau })
    s.set('appConfig', {
      schemaVersion: 2,
      thuMucXuatGanNhat: 'D:\\xuat-that',
      fileMauBangLuongGanNhat: 'D:\\mau.xlsx',
      kyXuLyGanNhat: '2026-08'
    })

    ghiHienThi({ scale: 1.15, rowHeight: 64, theme: 'dark', contrast: 'high' })

    // Nhân viên + kỳ đã lưu — nguyên vẹn tuyệt đối.
    expect(layNhanVien()).toHaveLength(2)
    expect(layNhanVien().map((n) => n.maNhanVien).sort()).toEqual(['00002', '00003'])
    expect(layDanhSachKy()).toEqual([kyMau])

    // Các field AppConfig khác không đổi, chỉ thêm hienThi.
    const c = layConfig()
    expect(c.thuMucXuatGanNhat).toBe('D:\\xuat-that')
    expect(c.fileMauBangLuongGanNhat).toBe('D:\\mau.xlsx')
    expect(c.kyXuLyGanNhat).toBe('2026-08')
    expect(c.schemaVersion).toBe(2)
    expect(c.hienThi).toEqual({ scale: 1.15, rowHeight: 64, theme: 'dark', contrast: 'high' })
  })
})
