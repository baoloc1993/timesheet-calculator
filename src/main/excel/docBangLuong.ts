// Đọc file bảng lương kỳ trước — rút danh sách nhân viên + đơn giá (cho "Nạp từ file kỳ trước").
// Đồng thời trả vị trí ô để ghiBangLuong ghi đè khi dùng chính file này làm khuôn.
// Chỗ dùng exceljs để ĐỌC bảng lương.

import ExcelJS from 'exceljs'
import type { NhanVien } from '../../core/types'
import { chuanHoaMa } from '../../core/ma'

export { chuanHoaMa }

export interface TheNhanVienBangLuong {
  maNhanVien: string
  tenBangLuong: string
  donGiaNgay: number
  donGiaGioOT: number
  // ô để ghi đè (địa chỉ kiểu "C5")
  oSoLuongNgay: string
  oSoLuongGio: string
  oDonGiaNgay: string
  oDonGiaGio: string
  // Vòng 6 (AC-5) — ô "Thành tiền" của 5 khoản nhập tay sẵn có trong mẫu. '' nếu không tìm thấy.
  oChuyenCan: string
  oBuLuong: string
  oLe: string
  oBaoHiem: string
  oVay: string
}

export interface BangLuongDaDoc {
  the: TheNhanVienBangLuong[]
}

function chuoi(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    const rt = (v as ExcelJS.CellRichTextValue).richText
    if (Array.isArray(rt)) return rt.map((t) => t.text).join('').trim()
  }
  return ''
}

/**
 * Bảng lương công ty đôi khi ghi mã DÍNH tên trong một ô ("00003 My83", "Tên: 00011 Lan89").
 * Bóc CỤM CHỮ SỐ ĐẦU (mã) khỏi phần còn lại (tên) — chỉ khi ô mã riêng để trống.
 * Chữ số Ở CUỐI tên ("Bác Lan 68", "Lan89") KHÔNG phải mã, giữ nguyên trong tên.
 */
export function bocMaVaTen(raw: string): { ma: string; ten: string } {
  const s = raw.trim()
  const m = s.match(/^(\d{1,6})\s+(\S.*)$/)
  if (m) return { ma: chuanHoaMa(m[1]), ten: m[2].trim() }
  return { ma: '', ten: s }
}

function so(v: ExcelJS.CellValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() && !isNaN(Number(v))) return Number(v)
  if (v && typeof v === 'object') {
    const f = v as ExcelJS.CellFormulaValue
    if ('result' in f && typeof f.result === 'number') return f.result
  }
  return 0
}

// Với mỗi cụm cột (trái: A/B/C/D/E, phải: G/H/I/J/K) tìm thẻ nhân viên. `tt` = cột "Thành tiền",
// nơi 5 khoản Chuyên cần/bù lương/Lễ/bảo hiểm/vay ghi số (vòng 6, AC-5).
const CUM = [
  { ten: 1, tenPhu: 2, ma: 4, dvt: 2, soLuong: 3, donGia: 4, tt: 5 }, // A B C D E
  { ten: 7, tenPhu: 8, ma: 10, dvt: 8, soLuong: 9, donGia: 10, tt: 11 } // G H I J K
]

/** Bỏ dấu tiếng Việt (mỗi dấu thanh/dấu phụ là MỘT ký tự Unicode riêng — không thể liệt kê
 * bằng character class như `[âa]`, phải chuẩn hoá rồi so bằng chữ không dấu). */
function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .trim()
    .toLowerCase()
}

/** Nhãn 5 khoản nhập tay, đúng thứ tự xuất hiện trong mẫu — so KHÔNG DẤU nên khớp cả khi
 * file thật của công ty ghi thiếu dấu ("bu luong" thay vì "bù lương"). */
const KHOAN_KHONG_DAU = {
  chuyenCan: 'chuyen can',
  buLuong: 'bu luong',
  le: 'le',
  baoHiem: 'bao hiem',
  vay: 'vay'
} as const

export async function docBangLuong(duongDan: string): Promise<{ wb: ExcelJS.Workbook; doc: BangLuongDaDoc }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(duongDan)
  const ws = wb.worksheets[0]
  const the: TheNhanVienBangLuong[] = []

  // Bảng lương công ty ~135 dòng. Cap để file .xlsx khai rowCount cực lớn không treo main.
  const tongDong = Math.min(ws.rowCount, 5000)
  // Chỉ khớp ô BẮT ĐẦU bằng "Tên:" (thẻ nhân viên) — không bắt "Tên đơn vị:", "Tên công ty:"…
  const RE_THE = /^\s*(họ và\s+)?t[êe]n\s*:/i
  for (const cum of CUM) {
    for (let r = 1; r <= tongDong; r++) {
      const row = ws.getRow(r)
      const oTen = chuoi(row.getCell(cum.ten).value)
      if (!RE_THE.test(oTen)) continue

      // tên: sau "Tên:" trong cùng ô, hoặc ô kế bên
      let ten = oTen.replace(/.*t[êe]n\s*:?\s*/i, '').trim()
      if (!ten) ten = chuoi(row.getCell(cum.tenPhu).value)

      // mã: ô riêng (cột D/J) trước; nếu trống thì bóc cụm chữ số đầu dính trong tên
      let ma = chuanHoaMa(chuoi(row.getCell(cum.ma).value))
      if (!ma) {
        const boc = bocMaVaTen(ten)
        if (boc.ma) {
          ma = boc.ma
          ten = boc.ten
        }
      }
      if (!ten && !ma) continue

      // quét xuống tối đa 6 dòng tìm "Lương tháng:" và "Làm thêm"
      let rNgay = -1
      let rGio = -1
      for (let k = 0; k <= 6 && r + k <= tongDong; k++) {
        const nhan = chuoi(ws.getRow(r + k).getCell(cum.ten).value).toLowerCase()
        if (rNgay < 0 && nhan.includes('lương tháng')) rNgay = r + k
        else if (rGio < 0 && nhan.includes('làm thêm')) rGio = r + k
      }
      // đôi khi ĐVT/số lượng nằm ngay dòng "Lương tháng", đôi khi lệch — dùng dòng có "ngày"/"giờ"
      const timDong = (tu: string, denhan: RegExp): number => {
        for (let k = 0; k <= 6; k++) {
          const rr = (tu === 'ngay' ? rNgay : rGio) + k
          if (rr < 1 || rr > tongDong) break
          if (denhan.test(chuoi(ws.getRow(rr).getCell(cum.dvt).value))) return rr
        }
        return tu === 'ngay' ? rNgay : rGio
      }
      const rrNgay = rNgay > 0 ? timDong('ngay', /ngày/i) : -1
      const rrGio = rGio > 0 ? timDong('gio', /giờ/i) : -1

      // Vòng 6 (AC-5) — quét tiếp xuống tìm 5 dòng khoản nhập tay (thường ngay sau dòng kỳ,
      // có thể cách một dòng trống — quét cửa sổ rộng hơn Lương tháng/Làm thêm ở trên).
      let rCC = -1
      let rBL = -1
      let rLe = -1
      let rBH = -1
      let rVay = -1
      for (let k = 0; k <= 20 && r + k <= tongDong; k++) {
        const nhan = boDau(chuoi(ws.getRow(r + k).getCell(cum.ten).value))
        if (rCC < 0 && nhan === KHOAN_KHONG_DAU.chuyenCan) rCC = r + k
        else if (rBL < 0 && nhan === KHOAN_KHONG_DAU.buLuong) rBL = r + k
        else if (rLe < 0 && nhan === KHOAN_KHONG_DAU.le) rLe = r + k
        else if (rBH < 0 && nhan === KHOAN_KHONG_DAU.baoHiem) rBH = r + k
        else if (rVay < 0 && nhan === KHOAN_KHONG_DAU.vay) rVay = r + k
      }

      const colL = (c: number) => String.fromCharCode(64 + c)
      const colTT = colL(cum.tt)
      the.push({
        maNhanVien: ma,
        tenBangLuong: ten,
        donGiaNgay: rrNgay > 0 ? so(ws.getRow(rrNgay).getCell(cum.donGia).value) : 0,
        donGiaGioOT: rrGio > 0 ? so(ws.getRow(rrGio).getCell(cum.donGia).value) : 0,
        oSoLuongNgay: rrNgay > 0 ? `${colL(cum.soLuong)}${rrNgay}` : '',
        oSoLuongGio: rrGio > 0 ? `${colL(cum.soLuong)}${rrGio}` : '',
        oDonGiaNgay: rrNgay > 0 ? `${colL(cum.donGia)}${rrNgay}` : '',
        oDonGiaGio: rrGio > 0 ? `${colL(cum.donGia)}${rrGio}` : '',
        oChuyenCan: rCC > 0 ? `${colTT}${rCC}` : '',
        oBuLuong: rBL > 0 ? `${colTT}${rBL}` : '',
        oLe: rLe > 0 ? `${colTT}${rLe}` : '',
        oBaoHiem: rBH > 0 ? `${colTT}${rBH}` : '',
        oVay: rVay > 0 ? `${colTT}${rVay}` : ''
      })
    }
  }

  return { wb, doc: { the } }
}

/**
 * Rút NhanVien (một phần) từ bảng lương để trộn vào Setup.
 * Giữ cả thẻ chỉ có tên (layout cũ không có cột mã) — `tronTuFileKyTruoc` khớp theo tên.
 */
export function nhanVienTuBangLuong(doc: BangLuongDaDoc): Partial<NhanVien>[] {
  return doc.the
    .filter((t) => t.maNhanVien || t.tenBangLuong)
    .map((t) => ({
      maNhanVien: t.maNhanVien,
      tenBangLuong: t.tenBangLuong,
      donGiaNgay: t.donGiaNgay,
      donGiaGioOT: t.donGiaGioOT
    }))
}
