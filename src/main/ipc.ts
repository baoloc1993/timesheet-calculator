// Điều phối IPC + mở dialog chọn file/thư mục. Không nhúng logic tính — gọi xuống core/.

import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { basename, join, dirname } from 'path'
import { existsSync } from 'fs'
import type { KetQuaKyCong, NhanVien } from '../core/types'
import { xuLyKyCong, tinhLaiMotDong, tinhLaiTongHop } from '../core/xuLyKyCong'
import { docFileMay, LoiDocFileMay } from './excel/docFileMay'
import { docBangLuong, nhanVienTuBangLuong } from './excel/docBangLuong'
import { ghiBangLuong } from './excel/ghiBangLuong'
import { ghiChiTietDaLamSach } from './excel/ghiChiTietDaLamSach'
import { layNhanVien, layConfig, ghiConfig } from './settings/store'
import { themHoacSua, xoaNhanVien, tronTuFileKyTruoc } from './settings/nhanVien'
import { log } from './logger'

interface KyHienTai {
  fileMay: string
  ky: KetQuaKyCong
}

let kyHienTai: KyHienTai | null = null

function win(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
}

function loi(e: unknown) {
  if (e instanceof LoiDocFileMay) return { ok: false, loi: e.message, maLoi: e.ma }
  const msg = (e as Error)?.message || 'Lỗi không xác định'
  log.error('IPC', msg)
  return { ok: false, loi: msg }
}

function tenFileXuat(thang: string) {
  const t = thang.replace('-', ' tháng ').slice(-2) || thang
  return {
    bangLuong: `bang luong thang ${t}.xlsx`,
    chiTiet: `chi tiet cong thang ${t} (da lam sach).xlsx`
  }
}

export function dangKyIpc(): void {
  ipcMain.handle('trang-thai', () => {
    const c = layConfig()
    return {
      soNhanVien: layNhanVien().length,
      kyXuLyGanNhat: c.kyXuLyGanNhat,
      thuMucXuatGanNhat: c.thuMucXuatGanNhat,
      fileMauBangLuongGanNhat: c.fileMauBangLuongGanNhat
    }
  })

  ipcMain.handle('nhan-vien:danh-sach', () => layNhanVien())

  ipcMain.handle('file-may:chon-va-nap', async () => {
    try {
      const w = win()
      const r = await dialog.showOpenDialog(w!, {
        title: 'Chọn file máy chấm công (.xlsx)',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        properties: ['openFile']
      })
      if (r.canceled || !r.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn file.' }
      const duongDan = r.filePaths[0]
      const file = await docFileMay(duongDan)
      const ky = xuLyKyCong(file, layNhanVien())
      kyHienTai = { fileMay: duongDan, ky }
      ghiConfig({ kyXuLyGanNhat: file.thang })
      log.info('nạp file máy', duongDan, `${file.khoi.length} khối`)
      return { ok: true, data: { ky, fileMay: duongDan } }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('nhan-vien:them-sua', async (_e, nv: Partial<NhanVien>) => {
    const r = themHoacSua(nv)
    if (!r.ok) return { ok: false, loi: 'Dữ liệu chưa hợp lệ.', loiTruong: r.loi }
    await lamMoiKyHienTai()
    return { ok: true, data: r.nhanVien, ky: layKyHienTai() }
  })

  ipcMain.handle('nhan-vien:xoa', async (_e, id: string) => {
    const ds = xoaNhanVien(id)
    await lamMoiKyHienTai()
    return { ok: true, data: ds, ky: layKyHienTai() }
  })

  ipcMain.handle('ky-cong:hien-tai', () => layKyHienTai())

  ipcMain.handle('nhan-vien:nap-tu-file-ky-truoc', async () => {
    try {
      const w = win()
      const r = await dialog.showOpenDialog(w!, {
        title: 'Chọn file bảng lương kỳ trước',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        properties: ['openFile']
      })
      if (r.canceled || !r.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn file.' }
      const { doc } = await docBangLuong(r.filePaths[0])
      const rut = nhanVienTuBangLuong(doc)
      if (rut.length === 0)
        return { ok: false, loi: 'Không rút được nhân viên nào từ file — kiểm tra đúng là file bảng lương.' }
      const ds = tronTuFileKyTruoc(rut)
      lamMoiKyHienTai()
      log.info('nạp nhân viên từ file kỳ trước', `${rut.length} thẻ`)
      return { ok: true, data: ds }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('bang-luong:chon-file-mau', async () => {
    try {
      const w = win()
      const r = await dialog.showOpenDialog(w!, {
        title: 'Chọn file mẫu bảng lương (thường là kỳ trước)',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        properties: ['openFile']
      })
      if (r.canceled || !r.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn file.' }
      ghiConfig({ fileMauBangLuongGanNhat: r.filePaths[0] })
      return { ok: true, data: { duongDan: r.filePaths[0] } }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('ky-cong:tinh-lai-ngay', (_e, p: { maNhanVien: string; ngay: string; cap: { vao: string | null; ra: string | null }[] }) => {
    if (!kyHienTai) return { ok: false, loi: 'Chưa nạp kỳ công.' }
    const th = kyHienTai.ky.tongHop.find((t) => t.maNhanVien === p.maNhanVien)
    if (!th) return { ok: false, loi: 'Không tìm thấy nhân viên trong kỳ.' }
    const idx = th.ketQuaNgay.findIndex((d) => d.ngay === p.ngay)
    if (idx < 0) return { ok: false, loi: 'Không tìm thấy ngày.' }
    const dongMoi = tinhLaiMotDong(th.ketQuaNgay[idx], p.cap, th.nguongGioChuanNgay)
    th.ketQuaNgay[idx] = dongMoi
    const thMoi = tinhLaiTongHop(th, th.ketQuaNgay)
    Object.assign(th, thMoi)
    capNhatTongKy()
    return { ok: true, data: { dong: dongMoi, tongHop: th } }
  })

  ipcMain.handle('ky-cong:xuat', async (_e, p: { ghiDe: boolean }) => {
    try {
      if (!kyHienTai) return { ok: false, loi: 'Chưa nạp kỳ công.' }
      if (kyHienTai.ky.thieuSetup.length > 0)
        return { ok: false, loi: 'Còn nhân viên chưa khai Setup — khai đủ trước khi xuất.' }

      const c = layConfig()
      if (!c.fileMauBangLuongGanNhat || !existsSync(c.fileMauBangLuongGanNhat))
        return { ok: false, loi: 'Chưa chọn file mẫu bảng lương. Bấm "Chọn file mẫu" trước.' }

      const w = win()
      const rDir = await dialog.showOpenDialog(w!, {
        title: 'Chọn thư mục lưu 2 file kết quả',
        defaultPath: c.thuMucXuatGanNhat || dirname(kyHienTai.fileMay),
        properties: ['openDirectory', 'createDirectory']
      })
      if (rDir.canceled || !rDir.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn thư mục.' }
      const thuMuc = rDir.filePaths[0]

      const ten = tenFileXuat(kyHienTai.ky.thang)
      const pBL = join(thuMuc, ten.bangLuong)
      const pCT = join(thuMuc, ten.chiTiet)

      if (!p.ghiDe) {
        const trung = [pBL, pCT].filter((x) => existsSync(x)).map((x) => basename(x))
        if (trung.length) return { ok: false, canXacNhanGhiDe: trung }
      }

      const bl = await ghiBangLuong(c.fileMauBangLuongGanNhat, pBL, kyHienTai.ky.tongHop)
      const ct = await ghiChiTietDaLamSach(kyHienTai.fileMay, pCT, kyHienTai.ky.tongHop)
      ghiConfig({ thuMucXuatGanNhat: thuMuc })
      log.info('xuất', thuMuc, `${bl.daGhi.length} thẻ lương, ${ct.soDongToVang} dòng vàng`)

      return {
        ok: true,
        data: {
          bangLuong: { duongDan: pBL, daGhi: bl.daGhi.length, khongKhop: bl.khongKhop },
          chiTiet: { duongDan: pCT, soDongToVang: ct.soDongToVang },
          thuMuc
        }
      }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('mo-thu-muc', (_e, duongDan: string) => {
    shell.openPath(duongDan)
  })
}

/** Sau khi Setup đổi → tính lại kỳ đang mở (nếu có) để AC-6 phản ánh ngay. */
async function lamMoiKyHienTai() {
  if (!kyHienTai) return
  try {
    const file = await docFileMay(kyHienTai.fileMay)
    kyHienTai = { fileMay: kyHienTai.fileMay, ky: xuLyKyCong(file, layNhanVien()) }
  } catch (e) {
    log.error('làm mới kỳ', (e as Error).message)
  }
}

function capNhatTongKy() {
  if (!kyHienTai) return
  const k = kyHienTai.ky
  k.tongNgayCongCaKy = Math.round(k.tongHop.reduce((s, t) => s + t.tongNgayCong, 0) * 100) / 100
  k.tongGioOTCaKy = Math.round(k.tongHop.reduce((s, t) => s + t.tongGioOT, 0) * 100) / 100
  k.tongDongCanXemLai = k.tongHop.reduce((s, t) => s + t.soDongCanXemLai, 0)
}

/** Cho renderer lấy lại kỳ hiện tại sau khi Setup thay đổi. */
export function layKyHienTai(): KetQuaKyCong | null {
  return kyHienTai?.ky ?? null
}
