// toàn vẹn dữ liệu config.json khi ghi/đọc AppConfig.mayChamCong qua
// src/main/settings/store.ts. Cùng mẫu với tests/core/hienThiStore.test.ts.
// lại còn nguyên") (field optional, KHÔNG migration).

import { describe, it, expect, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { MAC_DINH_CAU_HINH_MAY } from '../../src/core/mayChamCong'
import type { NhanVien } from '../../src/core/types'

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

describe('layCauHinhMay — config cũ', () => {
  it('đọc config không có mayChamCong → trả mặc định (ip rỗng, cổng 4370), không throw', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-maycc-cu-'))
    writeFileSync(
      join(d, 'config.json'),
      JSON.stringify({
        nhanVien: [nv('00002')],
        appConfig: {
          schemaVersion: 2,
          thuMucXuatGanNhat: 'D:\\xuat',
          fileMauBangLuongGanNhat: '',
          kyXuLyGanNhat: '2026-08'
        },
        ketQuaKy: {}
      })
    )
    const { layCauHinhMay } = await moStoreMoi(d)

    expect(() => layCauHinhMay()).not.toThrow()
    expect(layCauHinhMay()).toEqual(MAC_DINH_CAU_HINH_MAY)
  })

  it('config có mayChamCong rỗng {} (ghi tay/hỏng một phần) → vẫn trả mặc định, không throw', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-maycc-rong-'))
    writeFileSync(
      join(d, 'config.json'),
      JSON.stringify({
        nhanVien: [],
        appConfig: {
          schemaVersion: 2,
          thuMucXuatGanNhat: '',
          fileMauBangLuongGanNhat: '',
          kyXuLyGanNhat: '',
          mayChamCong: {}
        },
        ketQuaKy: {}
      })
    )
    const { layCauHinhMay } = await moStoreMoi(d)
    expect(layCauHinhMay()).toEqual(MAC_DINH_CAU_HINH_MAY)
  })
})

describe('ghiCauHinhMay — round-trip qua đĩa (đóng app mở lại còn nguyên)', () => {
  it('ghi IP + cổng rồi mở lại module store từ cùng thư mục → đọc lại đúng giá trị', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-maycc-roundtrip-'))
    const { ghiCauHinhMay } = await moStoreMoi(d)
    ghiCauHinhMay({ ip: '192.0.2.228', port: 4370 })

    // Giả lập "đóng app mở lại": nạp module store MỚI, trỏ về đúng thư mục đĩa cũ.
    const { layCauHinhMay } = await moStoreMoi(d)
    expect(layCauHinhMay()).toEqual({ ip: '192.0.2.228', port: 4370 })

    const raw = JSON.parse(readFileSync(cfgPath(), 'utf8'))
    expect(raw.appConfig.mayChamCong).toEqual({ ip: '192.0.2.228', port: 4370 })
  })

  it('patch một field (port) không làm mất field kia (ip) đã lưu trước đó', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-maycc-patch-'))
    const { ghiCauHinhMay, layCauHinhMay } = await moStoreMoi(d)

    ghiCauHinhMay({ ip: '10.0.0.5', port: 4370 })
    expect(layCauHinhMay()).toEqual({ ip: '10.0.0.5', port: 4370 })

    const ket = ghiCauHinhMay({ port: 4000 })
    expect(ket).toEqual({ ip: '10.0.0.5', port: 4000 }) // ip cũ không bị cuốn theo mất

    const raw = JSON.parse(readFileSync(cfgPath(), 'utf8'))
    expect(raw.appConfig.mayChamCong).toEqual({ ip: '10.0.0.5', port: 4000 })
  })

  it('giá trị lạ (cổng ngoài khoảng) không được lưu nguyên văn xuống đĩa — về mặc định của field đó', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-maycc-invalid-'))
    const { ghiCauHinhMay } = await moStoreMoi(d)

    const ket = ghiCauHinhMay({ ip: '10.0.0.9', port: 99999 as unknown as number })
    expect(ket).toEqual({ ip: '10.0.0.9', port: 4370 })

    const raw = JSON.parse(readFileSync(cfgPath(), 'utf8'))
    expect(raw.appConfig.mayChamCong).toEqual({ ip: '10.0.0.9', port: 4370 })
    expect(raw.appConfig.mayChamCong.port).not.toBe(99999)
  })

  it('ghi mayChamCong không đụng NhanVien / các field AppConfig khác', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tsc-maycc-khongdung-'))
    const { moStore, ghiCauHinhMay, layNhanVien, layConfig } = await moStoreMoi(d)

    const s = moStore()
    s.set('nhanVien', [nv('00002'), nv('00003')])
    s.set('appConfig', {
      schemaVersion: 2,
      thuMucXuatGanNhat: 'D:\\xuat-that',
      fileMauBangLuongGanNhat: 'D:\\mau.xlsx',
      kyXuLyGanNhat: '2026-08'
    })

    ghiCauHinhMay({ ip: '192.0.2.228', port: 4370 })

    expect(layNhanVien()).toHaveLength(2)
    expect(layNhanVien().map((n) => n.maNhanVien).sort()).toEqual(['00002', '00003'])

    const c = layConfig()
    expect(c.thuMucXuatGanNhat).toBe('D:\\xuat-that')
    expect(c.fileMauBangLuongGanNhat).toBe('D:\\mau.xlsx')
    expect(c.kyXuLyGanNhat).toBe('2026-08')
    expect(c.schemaVersion).toBe(2)
    expect(c.mayChamCong).toEqual({ ip: '192.0.2.228', port: 4370 })
  })
})
