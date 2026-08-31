// CRUD NhanVien trên store. Gọi từ src/main/ipc.ts.

import { randomUUID } from 'crypto'
import type { NhanVien } from '../../core/types'
import { moStore, chuanHoaNhanVien } from './store'

export interface LoiTruong {
  truong: string
  thongBao: string
}

export function kiemTraNhanVien(x: Partial<NhanVien>, danhSach: NhanVien[]): LoiTruong[] {
  const loi: LoiTruong[] = []
  const ma = String(x.maNhanVien ?? '').trim()
  if (!ma) loi.push({ truong: 'maNhanVien', thongBao: 'Bắt buộc nhập mã nhân viên.' })
  else if (danhSach.some((n) => n.maNhanVien === ma && n.id !== x.id))
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

/** Trộn danh sách rút từ file kỳ trước vào Setup (thêm mã mới, không đè mã đã có). */
export function tronTuFileKyTruoc(rut: Partial<NhanVien>[]): NhanVien[] {
  const store = moStore()
  const danhSach = store.get('nhanVien', [])
  const theoMa = new Map(danhSach.map((n) => [n.maNhanVien, n]))
  for (const r of rut) {
    const ma = String(r.maNhanVien ?? '').trim()
    if (!ma) continue
    const cu = theoMa.get(ma)
    if (cu) {
      // bổ sung ô còn trống, không đè giá trị người dùng đã khai
      if (!cu.tenBangLuong && r.tenBangLuong) cu.tenBangLuong = String(r.tenBangLuong)
      if (!cu.donGiaNgay && r.donGiaNgay) cu.donGiaNgay = Number(r.donGiaNgay)
      if (!cu.donGiaGioOT && r.donGiaGioOT) cu.donGiaGioOT = Number(r.donGiaGioOT)
      if (r.nguongGioChuanNgay && cu.nguongGioChuanNgay === 8.1)
        cu.nguongGioChuanNgay = Number(r.nguongGioChuanNgay)
    } else {
      const moi = chuanHoaNhanVien(r)
      danhSach.push({ ...moi, id: randomUUID() })
      theoMa.set(ma, moi)
    }
  }
  store.set('nhanVien', danhSach)
  return danhSach
}
