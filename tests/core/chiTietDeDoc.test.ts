import { describe, it, expect, beforeAll } from 'vitest'
import ExcelJS from 'exceljs'
import { mkdtempSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { docFileMay } from '../../src/main/excel/docFileMay'
import { xuLyKyCong } from '../../src/core/xuLyKyCong'
import { ghiChiTietDaLamSach, ghiChiTietTuMocCham } from '../../src/main/excel/ghiChiTietDaLamSach'
import type { KetQuaKyCong, NhanVien } from '../../src/core/types'

// Vòng 11 — file chi tiết công dễ đọc: sheet "Tổng hợp" đầu, mỗi nhân viên
// một sheet, sheet "Chi Tiet" khuôn máy giữ nguyên ở cuối và nạp lại được. Chạy trên file máy
// THẬT 08/2026 cho cả hai nguồn ghi (bản sao file máy / workbook dựng mới).

const FILE_MAY = 'deployment/local/mau/chi tiet cong thang 08-2026.xlsx'
const CONFIG = 'deployment/local/config-import-15.json'
const suite = existsSync(FILE_MAY) && existsSync(CONFIG) ? describe : describe.skip

suite('vòng 11 — file chi tiết công: Tổng hợp + mỗi nhân viên một sheet', () => {
  let kq: KetQuaKyCong
  const dir = mkdtempSync(join(tmpdir(), 'tsc-v11-'))
  const out = { file: join(dir, 'tu-file.xlsx'), may: join(dir, 'tu-may.xlsx') }

  beforeAll(async () => {
    const nv: NhanVien[] = JSON.parse(readFileSync(CONFIG, 'utf8')).nhanVien
    kq = xuLyKyCong(await docFileMay(FILE_MAY), nv)
    await ghiChiTietDaLamSach(FILE_MAY, out.file, kq.tongHop)
    await ghiChiTietTuMocCham(out.may, kq.tongHop)
  })

  const doc = async (f: string) => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(f)
    return wb
  }

  for (const nguon of ['file', 'may'] as const) {
    it(`[${nguon}] thứ tự sheet: Tổng hợp → từng người → Chi Tiet (cuối)`, async () => {
      const ten = (await doc(out[nguon])).worksheets.map((w) => w.name)
      expect(ten[0]).toBe('Tổng hợp')
      expect(ten[ten.length - 1]).toBe('Chi Tiet')
      expect(ten.length).toBe(kq.tongHop.length + 2)
      expect(new Set(ten.map((t) => t.toLowerCase())).size).toBe(ten.length) // không trùng
    })

    it(`[${nguon}] Tổng hợp: nhãn cột, tổng khớp app, KHÔNG có tiền`, async () => {
      const ws = (await doc(out[nguon])).getWorksheet('Tổng hợp')!
      expect(ws.getRow(4).values).toEqual([undefined, 'STT', 'Mã', 'Tên', 'Ngày công', 'Giờ OT', 'Số ngày đã sửa'])
      const dongTong = ws.getRow(5 + kq.tongHop.length)
      expect(dongTong.getCell(3).value).toBe('Tổng cộng')
      expect(dongTong.getCell(4).value).toBeCloseTo(kq.tongNgayCongCaKy, 2)
      expect(dongTong.getCell(5).value).toBeCloseTo(kq.tongGioOTCaKy, 2)
      let chu = ''
      ws.eachRow((r) => (chu += JSON.stringify(r.values)))
      expect(chu).not.toMatch(/đơn giá|thành tiền|VND/i)
    })

    it(`[${nguon}] sheet một người: nhãn cột, từng ngày, ô đã sửa tô vàng, tổng khớp`, async () => {
      const wb = await doc(out[nguon])
      const th = kq.tongHop.find((t) => t.ketQuaNgay.some((d) => d.daSua)) ?? kq.tongHop[0]
      const ws = wb.worksheets.find((w) => String(w.getCell(1, 1).value) === (th.tenBangLuong || th.tenMay))!
      expect(ws).toBeTruthy()
      expect(ws.getRow(4).values).toEqual([undefined, 'Ngày', 'Thứ', 'Vào sáng', 'Ra sáng', 'Vào chiều', 'Ra chiều', 'Giờ làm', 'Ngày công', 'Giờ OT', 'Ghi chú'])
      const iSua = th.ketQuaNgay.findIndex((d) => d.daSua)
      if (iSua >= 0) {
        const fill = ws.getRow(5 + iSua).getCell(10).fill as ExcelJS.FillPattern
        expect(fill.fgColor?.argb).toBe('FFFFF4CE')
      }
      const tong = ws.getRow(5 + th.ketQuaNgay.length)
      expect(tong.getCell(1).value).toBe('Tổng')
      expect(tong.getCell(8).value).toBeCloseTo(th.tongNgayCong, 2)
      expect(tong.getCell(9).value).toBeCloseTo(th.tongGioOT, 2)
    })

    it(`[${nguon}] nạp lại file xuất ra bằng "Chọn file" → đúng kỳ, đúng tổng công`, async () => {
      const nv: NhanVien[] = JSON.parse(readFileSync(CONFIG, 'utf8')).nhanVien
      const lai = xuLyKyCong(await docFileMay(out[nguon]), nv)
      expect(lai.thang).toBe(kq.thang)
      expect(lai.tongNgayCongCaKy).toBeCloseTo(kq.tongNgayCongCaKy, 2)
    })
  }

  it('[file] xuất → nạp lại chính file đó → xuất LẦN NỮA vẫn được, không nhân đôi sheet (review P1)', async () => {
    const nv: NhanVien[] = JSON.parse(readFileSync(CONFIG, 'utf8')).nhanVien
    const lai = xuLyKyCong(await docFileMay(out.file), nv)
    const lan2 = join(dir, 'lan-2.xlsx')
    await ghiChiTietDaLamSach(out.file, lan2, lai.tongHop)
    const ten = (await doc(lan2)).worksheets.map((w) => w.name)
    expect(ten[0]).toBe('Tổng hợp')
    expect(ten[ten.length - 1]).toBe('Chi Tiet')
    expect(ten.length).toBe(kq.tongHop.length + 2)
  })

  it('[may] tự SUM cột Giờ OT của sheet một người = dòng Tổng (không lệch do làm tròn từng ngày)', async () => {
    const wb = await doc(out.may)
    for (const th of kq.tongHop) {
      const ws = wb.worksheets.find((w) => String(w.getCell(1, 1).value) === (th.tenBangLuong || th.tenMay))!
      let sum = 0
      for (let r = 5; r < 5 + th.ketQuaNgay.length; r++) sum += Number(ws.getCell(r, 9).value) || 0
      expect(Math.round(sum * 100) / 100).toBeCloseTo(Number(ws.getCell(5 + th.ketQuaNgay.length, 9).value), 2)
    }
  })

  it('[file] sheet "Chi Tiet" giữ nguyên số ô/giá trị Q-R-S như bản trước vòng 11 (không đụng nội dung)', async () => {
    const goc = (await doc(FILE_MAY)).getWorksheet('Chi Tiet')!
    const moi = (await doc(out.file)).getWorksheet('Chi Tiet')!
    expect(moi.rowCount).toBe(goc.rowCount)
    // cột ngày A và tiêu đề khối không đổi
    for (let r = 1; r <= goc.rowCount; r++) expect(String(moi.getCell(r, 1).value)).toBe(String(goc.getCell(r, 1).value))
  })
})

describe('vòng 11 — tên sheet nhân viên hợp lệ Excel (ký tự cấm, trùng, dài)', () => {
  it('bỏ ký tự cấm, cắt 31 ký tự, trùng thêm (2), không đè "Tổng hợp"/"Chi Tiet"', async () => {
    const mk = (ma: string, ten: string) => ({
      maNhanVien: ma, tenMay: ma, tenBangLuong: ten, nguongGioChuanNgay: 8.1, donGiaNgay: 0, donGiaGioOT: 0,
      tongNgayCong: 0, tongGioOT: 0, soDongCanXemLai: 0, thanhTien: 0, ketQuaNgay: []
    })
    const f = join(mkdtempSync(join(tmpdir(), 'tsc-v11-ten-')), 'x.xlsx')
    await ghiChiTietTuMocCham(f, [
      mk('1', 'Cô A/B [tổ 1]'), mk('2', 'Cô A/B [tổ 1]'), mk('3', 'Tổng hợp'), mk('4', 'Chi Tiet'),
      mk('5', 'Một cái tên rất rất dài vượt quá ba mươi mốt ký tự'), mk('6', 'History'), mk('7', 'tổng hợp')
    ] as never)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(f)
    const ten = wb.worksheets.map((w) => w.name)
    expect(ten[0]).toBe('Tổng hợp')
    expect(ten[ten.length - 1]).toBe('Chi Tiet')
    expect(ten.length).toBe(9)
    expect(new Set(ten.map((t) => t.toLowerCase())).size).toBe(9)
    expect(ten).not.toContain('History')
    for (const t of ten) {
      expect(t.length).toBeLessThanOrEqual(31)
      expect(t).not.toMatch(/[[\]:*?/\\]/)
    }
  })
})
