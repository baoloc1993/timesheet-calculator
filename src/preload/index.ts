import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from './api-types'

// Khai window.api — danh sách kênh IPC có kiểu, KHÔNG lộ ipcRenderer thô.
const api: Api = {
  layTrangThai: () => ipcRenderer.invoke('trang-thai'),
  layNhanVien: () => ipcRenderer.invoke('nhan-vien:danh-sach'),
  chonVaNapFileMay: () => ipcRenderer.invoke('file-may:chon-va-nap'),
  themSuaNhanVien: (nv) => ipcRenderer.invoke('nhan-vien:them-sua', nv),
  xoaNhanVien: (id) => ipcRenderer.invoke('nhan-vien:xoa', id),
  napNhanVienTuFileKyTruoc: () => ipcRenderer.invoke('nhan-vien:nap-tu-file-ky-truoc'),
  chonFileMauBangLuong: () => ipcRenderer.invoke('bang-luong:chon-file-mau'),
  layKyHienTai: () => ipcRenderer.invoke('ky-cong:hien-tai'),
  tinhLaiNgay: (payload) => ipcRenderer.invoke('ky-cong:tinh-lai-ngay', payload),
  chonThuMucVaXuat: (payload) => ipcRenderer.invoke('ky-cong:xuat', payload),
  moThuMuc: (duongDan) => ipcRenderer.invoke('mo-thu-muc', duongDan)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error dev fallback
  window.api = api
}
