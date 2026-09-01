// CRUD NhanVien trên store. Gọi từ src/main/ipc.ts.

import { randomUUID } from 'crypto'
import type { NhanVien } from '../../core/types'
import { chuanHoaMa } from '../../core/ma'
import { moStore, chuanHoaNhanVien } from './store'

export interface LoiTruong {
  truong: string
  thongBao: string
}

export function kiemTraNhanVien(x: Partial<NhanVien>, danhSach: NhanVien[]): LoiTruong[] {
  const loi: LoiTruong[] = []
  const ma = chuanHoaMa(x.maNhanVien)
  if (!ma) loi.push({ truong: 'maNhanVien', thongBao: 'Bắt buộc nhập mã nhân viên.' })
  else if (danhSach.some((n) => chuanHoaMa(n.maNhanVien) === ma && n.id !== x.id))
    loi.push({ truong: 'maNhanVien', thongBao: `Mã "${ma}" đã có trong Setup.` })

  if (!String(x.tenMay ?? '').trim())
    loi.push({ truong: 'tenMay', thongBao: 'Bắt buộc nhập tên trên file máy.' })

  const ng = Number(x.nguongGioChuanNgay)
  if (!isFinite(ng) || ng <= 0 || ng > 16)
    loi.push({
      truong: 'nguongGioChuanNgay',
      thongBao: 'Phải là số từ 1 đến 16 (ví dụ 8.1).'
    })

  const dgN = Number(x.donGiaNgay)
  if (!isFinite(dgN) || dgN < 0)
    loi.push({ truong: 'donGiaNgay', thongBao: 'Phải là số không âm.' })

  const dgO = Number(x.donGiaGioOT)
  if (!isFinite(dgO) || dgO < 0)
    loi.push({ truong: 'donGiaGioOT', thongBao: 'Phải là số không âm.' })

  return loi
}

export function themHoacSua(x: Partial<NhanVien>): { ok: boolean; loi?: LoiTruong[]; nhanVien?: NhanVien[] } {
  const store = moStore()
  const danhSach = store.get('nhanVien', [])
  const loi = kiemTraNhanVien(x, danhSach)
  if (loi.length) return { ok: false, loi }

  const chuan = chuanHoaNhanVien(x)
  const idx = danhSach.findIndex((n) => n.id === x.id)
  if (idx >= 0) danhSach[idx] = { ...chuan, id: danhSach[idx].id }
  else danhSach.push({ ...chuan, id: randomUUID() })

  store.set('nhanVien', danhSach)
  return { ok: true, nhanVien: danhSach }
}

export function xoaNhanVien(id: string): NhanVien[] {
  const store = moStore()
  const danhSach = store.get('nhanVien', []).filter((n) => n.id !== id)
  store.set('nhanVien', danhSach)
  return danhSach
}

const chuanTen = (s: string | undefined): string =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

/**
 * Trộn danh sách rút từ file kỳ trước vào Setup.
 * - Có mã: khớp theo mã; chưa có → thêm mới, đã có → bổ sung ô trống (không đè người dùng đã khai).
 * - Không mã (layout bảng lương cũ): khớp theo `tenBangLuong` với người đã khai để bổ sung
 *   đơn giá; không tạo người mới.
 */
export function tronTuFileKyTruoc(rut: Partial<NhanVien>[]): NhanVien[] {
  const store = moStore()
  const danhSach = store.get('nhanVien', [])
  const theoMa = new Map(danhSach.map((n) => [chuanHoaMa(n.maNhanVien), n]))
  const theoTen = new Map(danhSach.map((n) => [chuanTen(n.tenBangLuong), n]))

  const boSungOTrong = (cu: NhanVien, r: Partial<NhanVien>): void => {
    if (!cu.tenBangLuong && r.tenBangLuong) cu.tenBangLuong = String(r.tenBangLuong)
    if (!cu.donGiaNgay && r.donGiaNgay) cu.donGiaNgay = Number(r.donGiaNgay)
    if (!cu.donGiaGioOT && r.donGiaGioOT) cu.donGiaGioOT = Number(r.donGiaGioOT)
  }

  for (const r of rut) {
    const ma = chuanHoaMa(r.maNhanVien)
    if (ma) {
      const cu = theoMa.get(ma)
      if (cu) boSungOTrong(cu, r)
      else {
        // Nhân viên mới từ bảng lương: chưa có tên trên file máy — tạm dùng tên bảng lương
        // để bản ghi không rỗng `tenMay` (người dùng rà lại ở Setup). Ghép kỳ vẫn theo mã.
        const moi = chuanHoaNhanVien({ ...r, tenMay: r.tenMay || r.tenBangLuong || '' })
        danhSach.push({ ...moi, id: randomUUID() })
        theoMa.set(ma, moi)
        if (moi.tenBangLuong) theoTen.set(chuanTen(moi.tenBangLuong), moi)
      }
      continue
    }
    const cuTheoTen = theoTen.get(chuanTen(r.tenBangLuong))
    if (cuTheoTen) boSungOTrong(cuTheoTen, r)
  }

  store.set('nhanVien', danhSach)
  return danhSach
}
