import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import ExcelJS from 'exceljs'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ghiBangLuong } from '../../src/main/excel/ghiBangLuong'
import { docBangLuong } from '../../src/main/excel/docBangLuong'
import type { TongHopNhanVien } from '../../src/core/types'

// mẫu bảng lương nhúng thiếu thẻ cho nhân viên trong kỳ → ghiBangLuong
// tự thêm thẻ theo khuôn thẻ chuẩn, ĐÚNG bộ ô (Số lượng ngày / giờ OT / Đơn giá),
// để trống Chuyên cần/bù lương/Lễ/BH/vay (hợp đồng BACKWARD-COMPATIBILITY §1f).
// Sai ở đây = bỏ sót người khi phát lương hoặc phá bộ ô người khác đang dùng.

function th(
  over: Partial<TongHopNhanVien> & Pick<TongHopNhanVien, 'maNhanVien' | 'tenBangLuong'>
): TongHopNhanVien {
  return {
    tenMay: over.tenBangLuong,
    nguongGioChuanNgay: 8.1,
    donGiaNgay: 300000,
    donGiaGioOT: 60000,
    tongNgayCong: 0,
    tongGioOT: 0,
    soDongCanXemLai: 0,
    thanhTien: 0,
    ketQuaNgay: [],
    ...over
  }
}

// Mẫu 2 cột: 1 thẻ có mã (00011 "Chị Mai"), 1 thẻ có mã (00089 "Bác Lan") sẽ KHÔNG dùng.
async function dungMau(path: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  const set = (c: string, v: string | number): void => {
    ws.getCell(c).value = v
  }
  set('A2', 'Tên:'); set('B2', 'Chị Mai'); set('D2', '00011')
  set('A5', 'Lương tháng:'); set('B5', 'ngày'); set('C5', 99); set('D5', 300000)
  set('A6', 'Làm thêm'); set('B6', 'giờ'); set('C6', 99); set('D6', 60000)

  set('G2', 'Tên:'); set('H2', 'Bác Lan'); set('J2', '00089')
  set('G5', 'Lương tháng:'); set('H5', 'ngày'); set('I5', 88); set('J5', 320000)
  set('G6', 'Làm thêm'); set('H6', 'giờ'); set('I6', 88); set('J6', 70000)
  await wb.xlsx.writeFile(path)
}

describe('ghiBangLuong — mẫu thiếu thẻ: thêm thẻ, không bỏ sót người, giữ bộ ô hợp đồng', () => {
  let dir: string
  let mau: string
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tsc-themthe-'))
    mau = join(dir, 'mau.xlsx')
    await dungMau(mau)
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('1 thẻ khớp + 2 thẻ thiếu → cả 3 người được ghi, 2 thẻ mới thêm, thẻ dư báo giữ số cũ', async () => {
    const ra = join(dir, 'bang luong 09.xlsx')
    const tongHop = [
      th({ maNhanVien: '00011', tenBangLuong: 'Chị Mai', tongNgayCong: 26, tongGioOT: 12 }),
      th({ maNhanVien: '00050', tenBangLuong: 'Người Mới A', tongNgayCong: 22, tongGioOT: 3, donGiaNgay: 275000, donGiaGioOT: 55000 }),
      th({ maNhanVien: '00051', tenBangLuong: 'Người Mới B', tongNgayCong: 18.5, tongGioOT: 0, donGiaNgay: 245000, donGiaGioOT: 50000 })
    ]
    const kq = await ghiBangLuong(mau, ra, tongHop, { ngayBatDau: '2026-09-01', ngayKetThuc: '2026-09-30' })

    expect(kq.daGhi.sort()).toEqual(['00011', '00050', '00051'])
    expect(kq.khongKhop).toEqual([])
    expect(kq.theThemMoi.sort()).toEqual(['Người Mới A', 'Người Mới B'])
    // Thẻ 00089 trong mẫu không thuộc kỳ này → giữ số kỳ trước, phải được liệt kê để người dùng biết.
    expect(kq.theGiuSoCu.some((t) => /Lan/.test(t))).toBe(true)
  })

  it('đọc lại file: 2 thẻ vừa thêm parse được, số ngày/OT đúng, KHÔNG chồng ô lên nhau', async () => {
    const ra = join(dir, 'bang luong 09b.xlsx')
    const tongHop = [
      th({ maNhanVien: '00050', tenBangLuong: 'Người Mới A', tongNgayCong: 22, tongGioOT: 3 }),
      th({ maNhanVien: '00051', tenBangLuong: 'Người Mới B', tongNgayCong: 19, tongGioOT: 7 })
    ]
    await ghiBangLuong(mau, ra, tongHop, { ngayBatDau: '2026-09-01', ngayKetThuc: '2026-09-30' })

    const { doc } = await docBangLuong(ra)
    const a = doc.the.find((t) => t.tenBangLuong.trim() === 'Người Mới A')
    const b = doc.the.find((t) => t.tenBangLuong.trim() === 'Người Mới B')
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(ra)
    const ws = wb.worksheets[0]
    const num = (c: string): number => {
      const v = ws.getCell(c).value
      return typeof v === 'number' ? v : Number(v)
    }
    expect(num(a!.oSoLuongNgay)).toBe(22)
    expect(num(a!.oSoLuongGio)).toBe(3)
    expect(num(b!.oSoLuongNgay)).toBe(19)
    expect(num(b!.oSoLuongGio)).toBe(7)
    // Hai thẻ mới không được trỏ vào cùng một ô (chồng số = một người mất số).
    expect(a!.oSoLuongNgay).not.toBe(b!.oSoLuongNgay)
    expect(a!.oSoLuongGio).not.toBe(b!.oSoLuongGio)
  })

  it('5 thẻ mới (3 hàng khối 2 cột) → cả 5 parse lại được, không thẻ nào chồng ô', async () => {
    const ra = join(dir, 'bang luong 09d.xlsx')
    const tongHop = Array.from({ length: 5 }, (_, i) =>
      th({
        maNhanVien: `009${i}0`,
        tenBangLuong: `Mới ${i + 1}`,
        tongNgayCong: 20 + i,
        tongGioOT: i
      })
    )
    const kq = await ghiBangLuong(mau, ra, tongHop, { ngayBatDau: '2026-09-01', ngayKetThuc: '2026-09-30' })
    expect(kq.theThemMoi.length).toBe(5)
    expect(kq.khongKhop).toEqual([])

    const { doc } = await docBangLuong(ra)
    const oO = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const t = doc.the.find((x) => x.tenBangLuong.trim() === `Mới ${i + 1}`)
      expect(t, `thẻ "Mới ${i + 1}" phải parse lại được`).toBeTruthy()
      // Mỗi ô Số lượng ngày/giờ là duy nhất trên toàn file → không thẻ nào ăn số của thẻ khác.
      expect(oO.has(t!.oSoLuongNgay)).toBe(false)
      oO.add(t!.oSoLuongNgay)
    }
  })

  it('thẻ mới để TRỐNG các khoản nhập tay (Chuyên cần/bù lương/Lễ/bảo hiểm/vay) — bộ ô hợp đồng', async () => {
    const ra = join(dir, 'bang luong 09c.xlsx')
    const tongHop = [
      th({ maNhanVien: '00050', tenBangLuong: 'Người Mới A', tongNgayCong: 22, tongGioOT: 3, donGiaNgay: 275000, donGiaGioOT: 55000 })
    ]
    await ghiBangLuong(mau, ra, tongHop, { ngayBatDau: '2026-09-01', ngayKetThuc: '2026-09-30' })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(ra)
    const ws = wb.worksheets[0]

    // Tìm dòng thẻ mới (ô có "Chuyên cần" trong cột A hoặc G).
    let rCC = -1
    let colTen = 'A'
    for (let r = 1; r <= ws.rowCount; r++) {
      for (const col of ['A', 'G']) {
        const v = ws.getCell(`${col}${r}`).value
        if (typeof v === 'string' && v.trim().toLowerCase() === 'chuyên cần') {
          rCC = r
          colTen = col
        }
      }
    }
    expect(rCC).toBeGreaterThan(0)

    // Cột "Thành tiền" của cụm (E cho cụm trái, K cho cụm phải).
    const colTT = colTen === 'A' ? 'E' : 'K'
    // 5 khoản nhập tay liên tiếp từ "Chuyên cần": Chuyên cần / bù lương / Lễ / bảo hiểm / vay
    // — ô Thành tiền phải trống (người dùng tự điền). "Tổng" ngay dưới thì có công thức.
    for (const [r, nhan] of ['Chuyên cần', 'bu lương', 'Lễ', 'bảo hiểm', 'vay'].entries()) {
      expect(ws.getCell(`${colTen}${rCC + r}`).value).toBe(nhan)
      const v = ws.getCell(`${colTT}${rCC + r}`).value
      expect(v == null || v === '').toBe(true)
    }
    expect(ws.getCell(`${colTen}${rCC + 5}`).value).toBe('Tổng')
    // Đơn giá ngày thì PHẢI có (bộ ô bắt buộc).
    const the = (await docBangLuong(ra)).doc.the.find((t) => t.tenBangLuong.trim() === 'Người Mới A')!
    expect(Number(ws.getCell(the.oDonGiaNgay).value)).toBe(275000)
  })
})
