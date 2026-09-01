import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import ExcelJS from 'exceljs'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { docFileMay } from '../../src/main/excel/docFileMay'
import { xuLyKyCong } from '../../src/core/xuLyKyCong'
import { ghiChiTietDaLamSach } from '../../src/main/excel/ghiChiTietDaLamSach'
import type { NhanVien } from '../../src/core/types'

// Smoke test luồng lõi trên fixture TỔNG HỢP (dựng bằng exceljs) —
// chạy được trong CI không cần dữ liệu thật. Đọc file máy → tính cả kỳ → phát hiện +
// sửa dòng bất thường → ghi file "chi tiết đã làm sạch". Gãy chỗ nào cũng đỏ ở đây.

const SETUP: NhanVien[] = [
  { id: '1', maNhanVien: '00001', tenMay: 'An', tenBangLuong: 'A', nguongGioChuanNgay: 8.1, donGiaNgay: 300000, donGiaGioOT: 70000, an: false },
  { id: '2', maNhanVien: '00002', tenMay: 'Bình', tenBangLuong: 'B', nguongGioChuanNgay: 10.6, donGiaNgay: 400000, donGiaGioOT: 80000, an: false }
]

// [ngày, vao1, ra1, vao2, ra2]  — null = không chấm
const NGAY_AN: [string, string | null, string | null, string | null, string | null][] = [
  ['2026-08-03', '07:00', '11:30', '13:30', '17:06'], // 8.1h đúng ngưỡng An → không OT
  ['2026-08-04', '07:00', '11:30', '13:30', '19:00'], // OT thật 1.5h
  ['2026-08-05', '07:05', null, '13:30', '17:30'], // thiếu ra1 → điền theo ngày kề, ép OT=0
  ['2026-08-06', '07:00', '17:30', null, null], // một cặp phủ trưa → cả ngày công, 0 OT, không cảnh báo
  ['2026-08-07', null, null, null, null] // nghỉ cả ngày → none
]

async function dungFileMay(path: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Chi Tiet')
  for (const nv of SETUP) {
    ws.addRow([`Mã nhân viên: ${nv.maNhanVien}   Tên nhân viên: ${nv.tenMay}   Bộ phận: ---`])
    ws.addRow(['Ngày', 'Thứ', 'Vào', 'Ra', 'Vào', 'Ra', 'Vào', 'Ra'])
    for (const [ngay, ...moc] of NGAY_AN) {
      const row: (string | Date | null)[] = [new Date(ngay + 'T00:00:00Z'), 'T2', ...moc]
      ws.addRow(row)
    }
    ws.addRow([]) // ngăn cách khối
  }
  await wb.xlsx.writeFile(path)
}

describe('luồng lõi trên fixture tổng hợp (CI)', () => {
  let dir: string
  let fileMay: string

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tsc-pipeline-'))
    fileMay = join(dir, 'chi tiet cong thang 08-2026.xlsx')
    await dungFileMay(fileMay)
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('parse ra 2 khối, đúng kỳ', async () => {
    const f = await docFileMay(fileMay)
    expect(f.thang).toBe('2026-08')
    expect(f.khoi.map((k) => k.maNhanVien).sort()).toEqual(['00001', '00002'])
  })

  it('tính cả kỳ: ngưỡng riêng, dòng bất thường bị bắt, nghỉ không cảnh báo', async () => {
    const f = await docFileMay(fileMay)
    const kq = xuLyKyCong(f, SETUP)
    expect(kq.thieuSetup).toHaveLength(0)

    const an = kq.tongHop.find((t) => t.maNhanVien === '00001')!
    const d = (ngay: string) => an.ketQuaNgay.find((x) => x.ngay === ngay)!

    expect(d('2026-08-03').gioOtS).toBe(0)
    expect(d('2026-08-04').gioOtS).toBeGreaterThan(1) // OT thật giữ nguyên
    expect(d('2026-08-05').mucDoCanhBao).toBe('vang')
    expect(d('2026-08-05').gioOtS).toBe(0) // thiếu chấm → ép OT=0
    expect(d('2026-08-05').otBiEp).toBe(true)
    expect(d('2026-08-06').mucDoCanhBao).toBe('none') // một cặp phủ trưa (07:00–17:30) → cả ngày công, không cảnh báo
    expect(d('2026-08-06').ngayCongR).toBe(1)
    expect(d('2026-08-06').gioOtS).toBe(0)
    expect(d('2026-08-07').mucDoCanhBao).toBe('none') // nghỉ thật
    expect(d('2026-08-07').ngayCongR).toBe(0)

    // Bình ngưỡng 10.6 → ngày OT-thật của An (19:00) với Bình thì chưa vượt ngưỡng
    const binh = kq.tongHop.find((t) => t.maNhanVien === '00002')!
    expect(binh.ketQuaNgay.find((x) => x.ngay === '2026-08-04')!.gioOtS).toBe(0)
  })

  it('ghi được file chi tiết đã làm sạch, số dòng vàng khớp daSua', async () => {
    const f = await docFileMay(fileMay)
    const kq = xuLyKyCong(f, SETUP)
    const ra = join(dir, 'chi tiet (da lam sach).xlsx')
    const ct = await ghiChiTietDaLamSach(fileMay, ra, kq.tongHop)
    expect(existsSync(ra)).toBe(true)
    const soDaSua = kq.tongHop.reduce((s, t) => s + t.ketQuaNgay.filter((x) => x.daSua).length, 0)
    expect(ct.soDongToVang).toBe(soDaSua)
  })
})
