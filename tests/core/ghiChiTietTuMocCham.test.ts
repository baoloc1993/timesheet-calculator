import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import ExcelJS from 'exceljs'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ghiChiTietTuMocCham } from '../../src/main/excel/ghiChiTietDaLamSach'
import { gomMocCham } from '../../src/core/gomMocCham'
import type { MocChamTho } from '../../src/core/gomMocCham'
import { xuLyKyCong } from '../../src/core/xuLyKyCong'
import type { NhanVien, TongHopNhanVien } from '../../src/core/types'

// .xlsx gốc, dựng workbook mới từ đầu, cùng cấu trúc cột (Q=17/R=18/S=19, ô sửa tô vàng
// #FFF4CE) để S6/AC-2 không phân biệt được kỳ nạp từ đâu". Chưa có test integration nào
// đọc lại file do hàm này ghi ra — bài trước (pipelineTongHop.test.ts) chỉ phủ nhánh
// ghiChiTietDaLamSach() (có file gốc).

const moc = (userId: string | number, isoLocal: string): MocChamTho => ({
  userId,
  timestamp: new Date(isoLocal)
})

const SETUP: NhanVien[] = [
  {
    id: '1',
    maNhanVien: '00001',
    tenMay: 'An',
    tenBangLuong: 'Ông An',
    nguongGioChuanNgay: 8.1,
    donGiaNgay: 300000,
    donGiaGioOT: 70000,
    an: false
  }
]

function nhanVienKhongChamCong(): TongHopNhanVien {
  return {
    maNhanVien: '00099',
    tenMay: '00099',
    tenBangLuong: 'Bà Không Chấm',
    nguongGioChuanNgay: 8.1,
    donGiaNgay: 300000,
    donGiaGioOT: 70000,
    tongNgayCong: 0,
    tongGioOT: 0,
    soDongCanXemLai: 0,
    thanhTien: 0,
    ketQuaNgay: []
  }
}

describe('ghiChiTietTuMocCham — dựng file "chi tiết đã làm sạch" từ log máy (không có file gốc)', () => {
  let dir: string
  let ra: string

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tsc-tumoccham-'))
    ra = join(dir, 'chi tiet tu moc cham.xlsx')
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('ngày đủ 4 mốc (không sửa) + ngày thiếu mốc (được điền, tô vàng) + nhân viên không có ngày chấm nào — file ghi ra không hỏng', async () => {
    // 2026-08-03: đủ 4 mốc → không sửa. 2026-08-04: 3 mốc lẻ (thiếu ra2) → công cụ điền
    // theo ngày liền trước, ép OT=0, tô vàng.
    const { file } = gomMocCham(
      [
        moc('00001', '2026-08-03T07:00:00'),
        moc('00001', '2026-08-03T11:30:00'),
        moc('00001', '2026-08-03T13:30:00'),
        moc('00001', '2026-08-03T17:00:00'),
        moc('00001', '2026-08-04T07:00:00'),
        moc('00001', '2026-08-04T11:30:00'),
        moc('00001', '2026-08-04T13:30:00')
      ],
      '2026-08-01',
      '2026-08-31'
    )
    const ky = xuLyKyCong(file, SETUP)
    expect(ky.thieuSetup).toEqual([])
    const an = ky.tongHop.find((t) => t.maNhanVien === '00001')!
    const ngay03 = an.ketQuaNgay.find((k) => k.ngay === '2026-08-03')!
    const ngay04 = an.ketQuaNgay.find((k) => k.ngay === '2026-08-04')!
    expect(ngay03.daSua).toBe(false)
    expect(ngay04.daSua).toBe(true)
    expect(ngay04.mucDoCanhBao).toBe('vang')
    expect(ngay04.gioOtS).toBe(0)

    const tongHop = [an, nhanVienKhongChamCong()]

    // Không throw kể cả có nhân viên rỗng ketQuaNgay (không có ngày chấm nào trong kỳ).
    const ket = await ghiChiTietTuMocCham(ra, tongHop)
    expect(existsSync(ra)).toBe(true)
    const soDaSua = tongHop.reduce((s, t) => s + t.ketQuaNgay.filter((k) => k.daSua).length, 0)
    expect(ket.soDongToVang).toBe(soDaSua)
    expect(ket.soDongToVang).toBe(1)

    // Đọc lại file bằng exceljs — xác nhận đúng vị trí cột Q/R/S + màu tô vàng đúng khoá.
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(ra)
    const ws = wb.getWorksheet('Chi Tiet')!

    const hangTheoNgay = new Map<string, number>()
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      const v = row.getCell(1).value
      if (v instanceof Date) {
        const iso = `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(
          v.getUTCDate()
        ).padStart(2, '0')}`
        hangTheoNgay.set(iso, r)
      }
    })

    const r03 = hangTheoNgay.get('2026-08-03')!
    const r04 = hangTheoNgay.get('2026-08-04')!
    expect(r03).toBeGreaterThan(0)
    expect(r04).toBeGreaterThan(0)

    // Cột Q=17/R=18/S=19 đúng giá trị tính được, không lệch vị trí.
    expect(ws.getRow(r03).getCell(17).value).toBe(ngay03.gioLamQ)
    expect(ws.getRow(r03).getCell(18).value).toBe(ngay03.ngayCongR)
    expect(ws.getRow(r03).getCell(19).value).toBe(ngay03.gioOtS)
    expect(ws.getRow(r04).getCell(18).value).toBe(ngay04.ngayCongR)
    expect(ws.getRow(r04).getCell(19).value).toBe(0)

    // Ngày không sửa (03) → không ô nào trong C..H bị tô vàng.
    for (let c = 3; c <= 6; c++) {
      const fill = ws.getRow(r03).getCell(c).fill as ExcelJS.FillPattern | undefined
      expect(fill?.fgColor?.argb).toBeUndefined()
    }

    // Ngày sửa (04) → ô lệch gốc (mốc điền hộ) VÀ ô S đều tô đúng màu khoá #FFF4CE
    //.
    let coOTuVang = false
    for (let c = 3; c <= 6; c++) {
      const fill = ws.getRow(r04).getCell(c).fill as ExcelJS.FillPattern | undefined
      if (fill?.fgColor?.argb === 'FFFFF4CE') coOTuVang = true
    }
    expect(coOTuVang).toBe(true)
    const fillS = ws.getRow(r04).getCell(19).fill as ExcelJS.FillPattern | undefined
    expect(fillS?.fgColor?.argb).toBe('FFFFF4CE')

    // Header của nhân viên không có ngày chấm nào vẫn được ghi (không bị rớt khối, không lỗi).
    let coHeaderKhongCham = false
    ws.eachRow({ includeEmpty: false }, (row) => {
      const v = row.getCell(1).value
      if (typeof v === 'string' && v.includes('00099')) coHeaderKhongCham = true
    })
    expect(coHeaderKhongCham).toBe(true)
  })
})
