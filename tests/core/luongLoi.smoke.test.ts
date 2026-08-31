import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { docFileMay } from '../../src/main/excel/docFileMay'
import { xuLyKyCong } from '../../src/core/xuLyKyCong'
import { ghiBangLuong } from '../../src/main/excel/ghiBangLuong'
import { ghiChiTietDaLamSach } from '../../src/main/excel/ghiChiTietDaLamSach'
import type { KetQuaKyCong, NhanVien } from '../../src/core/types'

// Smoke test luồng lõi: đọc file máy THẬT (08/2026) → tính cả kỳ →
// ghi 2 file kết quả. Một test này chạy hết đường chính; gãy chỗ nào cũng đỏ ở đây.

const DIR = 'deployment/local/mau'
const FILE_MAY = join(DIR, 'chi tiet cong thang 08-2026.xlsx')
const FILE_MAU = join(DIR, 'bang luong thang 07 (mau).xlsx')

const coDuLieu = existsSync(FILE_MAY) && existsSync(FILE_MAU)
const suite = coDuLieu ? describe : describe.skip

suite('luồng lõi end-to-end trên dữ liệu thật 08/2026', () => {
  let kq: KetQuaKyCong
  let nhanVien: NhanVien[]
  let outDir: string

  beforeAll(async () => {
    const seed = JSON.parse(readFileSync('deployment/local/nhan-vien-seed.json', 'utf8'))
    nhanVien = seed.map((s: Record<string, unknown>, i: number) => ({ ...s, id: 'nv-' + i, an: false }))
    const file = await docFileMay(FILE_MAY)
    kq = xuLyKyCong(file, nhanVien)
    outDir = mkdtempSync(join(tmpdir(), 'tsc-smoke-'))
  })

  it('parse ra đúng kỳ và có khối nhân viên', async () => {
    const file = await docFileMay(FILE_MAY)
    expect(file.thang).toBe('2026-08')
    expect(file.ngayBatDau).toBe('2026-08-01')
    expect(file.khoi.length).toBeGreaterThan(10)
  })

  it('nhân viên trong file mà chưa khai Setup → liệt kê ở thieuSetup, không tính', () => {
    // 00012/Dinh và 00025/NguyenHa có trong file máy nhưng không có trong seed
    expect(kq.thieuSetup.length).toBeGreaterThan(0)
    const maThieu = kq.thieuSetup.map((t) => t.maNhanVien)
    for (const m of maThieu) {
      expect(kq.tongHop.find((t) => t.maNhanVien === m)).toBeUndefined()
    }
  })

  it('mọi KếtQuảNgày hợp lệ: R ∈ {0,0.5,1}, S ≥ 0, bất biến daSua↔ghiChuSua↔cảnh báo', () => {
    for (const t of kq.tongHop) {
      for (const d of t.ketQuaNgay) {
        expect([0, 0.5, 1]).toContain(d.ngayCongR)
        expect(d.gioOtS).toBeGreaterThanOrEqual(0)
        if (d.daSua) expect(d.ghiChuSua).not.toBe('')
        else expect(d.ghiChuSua).toBe('')
        if (!d.daSua) expect(d.mucDoCanhBao).toBe('none')
        // nghỉ cả ngày (không cặp nào) → không được cảnh báo
        if (d.capVaoRa.length === 0) {
          expect(d.mucDoCanhBao).toBe('none')
          expect(d.ngayCongR).toBe(0)
        }
      }
      // tổng nhân viên = Σ trên các ngày
      const sumR = t.ketQuaNgay.reduce((s, d) => s + d.ngayCongR, 0)
      expect(t.tongNgayCong).toBeCloseTo(sumR, 4)
    }
  })

  it('tổng ngày công cả kỳ khớp con số đối chiếu tay (AC-2): 339', () => {
    // Golden value: ngày công đã đối chiếu tay 100% (MEMORY: ot-reconciliation-status).
    expect(kq.tongNgayCongCaKy).toBe(339)
  })

  it('ca lộn qua ngày của Dũng 16/08 bị bắt: cảnh báo vàng + OT ép 0', () => {
    const dung = kq.tongHop.find((t) => t.maNhanVien === '00015')!
    const d16 = dung.ketQuaNgay.find((d) => d.ngay === '2026-08-16')!
    expect(d16.mucDoCanhBao).toBe('vang')
    expect(d16.gioOtS).toBe(0)
    expect(d16.nguonGoc).toContain('07:02') // mốc lộn ngày còn lưu trong nguồn gốc
  })

  it('nạp lại cùng kỳ → kết quả giống hệt (không cộng dồn)', async () => {
    const file = await docFileMay(FILE_MAY)
    const lai = xuLyKyCong(file, nhanVien)
    expect(lai).toEqual(kq)
  })

  it('ghi được bảng lương + chi tiết đã làm sạch, không ném lỗi', async () => {
    const bl = await ghiBangLuong(FILE_MAU, join(outDir, 'bang luong 08.xlsx'), kq.tongHop, {
      ngayBatDau: kq.ngayBatDau,
      ngayKetThuc: kq.ngayKetThuc
    })
    expect(bl.daGhi.length).toBeGreaterThan(0)
    expect(existsSync(bl.duongDanRa)).toBe(true)

    const ct = await ghiChiTietDaLamSach(FILE_MAY, join(outDir, 'chi tiet 08 (da lam sach).xlsx'), kq.tongHop)
    expect(existsSync(ct.duongDanRa)).toBe(true)
    // số dòng tô vàng = số dòng daSua trên toàn kỳ
    const soDaSua = kq.tongHop.reduce(
      (s, t) => s + t.ketQuaNgay.filter((d) => d.daSua).length,
      0
    )
    expect(ct.soDongToVang).toBe(soDaSua)
  })
})
