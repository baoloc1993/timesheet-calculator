import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import ExcelJS from 'exceljs'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { chuanHoaMa } from '../../src/core/ma'
import { docBangLuong, nhanVienTuBangLuong, bocMaVaTen } from '../../src/main/excel/docBangLuong'

// Vòng 2 (AC-4): "Nạp từ file kỳ trước" parse đúng bảng lương 2 cột — mã 5 chữ số TÁCH
// khỏi chữ số trong tên (My83 → mã 00003, không 0000383; Lan89 → không 0001189).

describe('chuanHoaMa — lấy cụm chữ số đầu, không gộp chữ số trong tên', () => {
  it('mã sạch từ máy', () => {
    expect(chuanHoaMa('00015')).toBe('00015')
    expect(chuanHoaMa('15')).toBe('00015')
    expect(chuanHoaMa(' 003 ')).toBe('00003')
  })
  it('mã dính tên có chữ số → chỉ lấy cụm đầu', () => {
    expect(chuanHoaMa('00003 My83')).toBe('00003')
    expect(chuanHoaMa('00011 Lan89')).toBe('00011')
  })
  it('không chữ số → giữ chuỗi', () => {
    expect(chuanHoaMa('')).toBe('')
    expect(chuanHoaMa('Cô Mỹ')).toBe('Cô Mỹ')
  })
})

describe('bocMaVaTen', () => {
  it('bóc mã đầu, giữ phần tên (kể cả chữ số cuối tên)', () => {
    expect(bocMaVaTen('00003 My83')).toEqual({ ma: '00003', ten: 'My83' })
    expect(bocMaVaTen('7 Lan89')).toEqual({ ma: '00007', ten: 'Lan89' })
  })
  it('tên không có mã đầu → mã rỗng, tên nguyên', () => {
    expect(bocMaVaTen('Bác Lan 68')).toEqual({ ma: '', ten: 'Bác Lan 68' })
    expect(bocMaVaTen('Lan89')).toEqual({ ma: '', ten: 'Lan89' })
  })
})

// Dựng bảng lương 2 cột theo đúng layout công ty:
//  trái  A(nhãn)/B(ĐVT|tên)/C(số lượng)/D(đơn giá|mã)   phải G/H/I/J
async function dungBangLuong(path: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  const set = (cell: string, v: string | number) => (ws.getCell(cell).value = v)

  // thẻ 1 (trái): mã ở ô riêng D
  set('A2', 'Tên:'); set('B2', 'Cô Mỹ'); set('D2', '003')
  set('B4', 'ĐVT'); set('C4', 'Số lượng'); set('D4', 'Đơn giá')
  set('A5', 'Lương tháng:'); set('B5', 'ngày'); set('C5', 26.5); set('D5', 240000)
  set('A6', 'Làm thêm'); set('B6', 'giờ'); set('C6', 18.4); set('D6', 70000)

  // thẻ 1 (phải): tên có chữ số cuối + mã ô riêng J
  set('G2', 'Tên:'); set('H2', 'Lan89'); set('J2', '0011')
  set('H4', 'ĐVT'); set('I4', 'Số lượng'); set('J4', 'Đơn giá')
  set('G5', 'Lương tháng:'); set('H5', 'ngày'); set('I5', 21.5); set('J5', 240000)
  set('G6', 'Làm thêm'); set('H6', 'giờ'); set('I6', 7); set('J6', 70000)

  // thẻ 2 (trái): mã DÍNH tên trong một ô "Tên: 00007 My83" (ô mã D để trống)
  set('A18', 'Tên: 00007 My83')
  set('B20', 'ĐVT'); set('C20', 'Số lượng'); set('D20', 'Đơn giá')
  set('A21', 'Lương tháng:'); set('B21', 'ngày'); set('C21', 20); set('D21', 250000)
  set('A22', 'Làm thêm'); set('B22', 'giờ'); set('C22', 2); set('D22', 60000)

  await wb.xlsx.writeFile(path)
}

describe('docBangLuong — layout 2 cột', () => {
  let dir: string
  let file: string
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tsc-bl-'))
    file = join(dir, 'bang luong.xlsx')
    await dungBangLuong(file)
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('đọc đúng mã từ ô riêng, không nuốt chữ số trong tên', async () => {
    const { doc } = await docBangLuong(file)
    const my = doc.the.find((t) => t.tenBangLuong === 'Cô Mỹ')!
    const lan = doc.the.find((t) => t.tenBangLuong === 'Lan89')!
    expect(my.maNhanVien).toBe('00003')
    expect(lan.maNhanVien).toBe('00011') // KHÔNG '0001189'
    expect(lan.donGiaNgay).toBe(240000)
  })

  it('mã dính tên trong một ô → tách mã 00007, tên còn "My83"', async () => {
    const { doc } = await docBangLuong(file)
    const t = doc.the.find((x) => x.maNhanVien === '00007')!
    expect(t.tenBangLuong).toBe('My83') // KHÔNG '0000383'
    expect(t.donGiaNgay).toBe(250000)
    expect(t.donGiaGioOT).toBe(60000)
  })

  it('nhanVienTuBangLuong trả về các thẻ có mã hoặc tên', async () => {
    const { doc } = await docBangLuong(file)
    const rut = nhanVienTuBangLuong(doc)
    expect(rut.map((r) => r.maNhanVien).sort()).toEqual(['00003', '00007', '00011'])
  })
})
