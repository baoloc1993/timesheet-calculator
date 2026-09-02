import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import ExcelJS from 'exceljs'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ghiBangLuong } from '../../src/main/excel/ghiBangLuong'
import type { TongHopNhanVien } from '../../src/core/types'

// Vòng 2 regression (AC-4 + AC-5): sau khi chuanHoaMa đổi ngữ nghĩa (bóc cụm chữ số đầu),
// ghiBangLuong vẫn phải khớp ĐÚNG thẻ theo mã, KHÔNG nhầm vì chữ số nằm trong tên
// ("Lan89" không được ghép với thẻ mã "00089"). Nhầm = điền số công/OT sai người → lương sai.

function th(over: Partial<TongHopNhanVien> & Pick<TongHopNhanVien, 'maNhanVien' | 'tenBangLuong'>): TongHopNhanVien {
  return {
    tenMay: over.tenBangLuong,
    nguongGioChuanNgay: 8.1,
    donGiaNgay: 240000,
    donGiaGioOT: 70000,
    tongNgayCong: 0,
    tongGioOT: 0,
    soDongCanXemLai: 0,
    thanhTien: 0,
    ketQuaNgay: [],
    ...over
  }
}

// Bảng lương 2 cột, mã ở ô riêng (D/J) — layout mới có cột mã.
async function dungMau(path: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  const set = (c: string, v: string | number): void => {
    ws.getCell(c).value = v
  }
  // thẻ trái: tên có chữ số cuối "Lan89", mã riêng 00011
  set('A2', 'Tên:'); set('B2', 'Lan89'); set('D2', '00011')
  set('A5', 'Lương tháng:'); set('B5', 'ngày'); set('C5', 0); set('D5', 240000)
  set('A6', 'Làm thêm'); set('B6', 'giờ'); set('C6', 0); set('D6', 70000)
  // thẻ phải: tên "Lan", mã riêng 00089 (đúng cái chữ số bị nghi nuốt từ tên thẻ trái)
  set('G2', 'Tên:'); set('H2', 'Lan'); set('J2', '00089')
  set('G5', 'Lương tháng:'); set('H5', 'ngày'); set('I5', 0); set('J5', 300000)
  set('G6', 'Làm thêm'); set('H6', 'giờ'); set('I6', 0); set('J6', 70000)
  await wb.xlsx.writeFile(path)
}

describe('ghiBangLuong — khớp theo mã, không nhầm vì chữ số trong tên', () => {
  let dir: string
  let mau: string
  let ra: string
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tsc-ghibl-'))
    mau = join(dir, 'mau.xlsx')
    ra = join(dir, 'bang luong 08.xlsx')
    await dungMau(mau)
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('"Lan89" (mã 00011) và "Lan" (mã 00089) điền vào đúng thẻ của mình', async () => {
    const tongHop = [
      th({ maNhanVien: '00011', tenBangLuong: 'Lan89', tongNgayCong: 25, tongGioOT: 4 }),
      th({ maNhanVien: '00089', tenBangLuong: 'Lan', tongNgayCong: 10, tongGioOT: 0 })
    ]
    const kq = await ghiBangLuong(mau, ra, tongHop, { ngayBatDau: '2026-08-01', ngayKetThuc: '2026-08-31' })

    expect(kq.daGhi.sort()).toEqual(['00011', '00089'])
    expect(kq.khongKhop).toEqual([])

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(ra)
    const ws = wb.worksheets[0]
    const num = (c: string): number => {
      const v = ws.getCell(c).value
      return typeof v === 'number' ? v : Number(v)
    }
    // thẻ trái (Lan89): C5 = số ngày, C6 = số giờ OT
    expect(num('C5')).toBe(25)
    expect(num('C6')).toBe(4)
    // thẻ phải (Lan): I5 = số ngày, I6 = số giờ OT
    expect(num('I5')).toBe(10)
    expect(num('I6')).toBe(0)
  })

  it('vòng 3 (AC-5): nhân viên chưa có thẻ trong mẫu → tự thêm thẻ theo khuôn, điền đúng số', async () => {
    const tongHop = [
      th({ maNhanVien: '00099', tenBangLuong: 'Không Có Thẻ', tongNgayCong: 22, tongGioOT: 3, donGiaNgay: 300000, donGiaGioOT: 60000 })
    ]
    const ra2 = join(dir, 'bang luong 08b.xlsx')
    const kq = await ghiBangLuong(mau, ra2, tongHop, { ngayBatDau: '2026-08-01', ngayKetThuc: '2026-08-31' })

    expect(kq.daGhi).toEqual(['00099'])
    expect(kq.khongKhop).toEqual([])
    expect(kq.theThemMoi).toEqual(['Không Có Thẻ'])

    // Đọc lại: thẻ mới parse được + số đúng.
    const { docBangLuong } = await import('../../src/main/excel/docBangLuong')
    const { doc } = await docBangLuong(ra2)
    const the = doc.the.find((t) => t.tenBangLuong.trim() === 'Không Có Thẻ')
    expect(the).toBeTruthy()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(ra2)
    const ws = wb.worksheets[0]
    const num = (c: string): number => {
      const v = ws.getCell(c).value
      return typeof v === 'number' ? v : Number(v)
    }
    expect(num(the!.oSoLuongNgay)).toBe(22)
    expect(num(the!.oSoLuongGio)).toBe(3)
  })
})
