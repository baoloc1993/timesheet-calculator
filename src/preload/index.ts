import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from './api-types'

// Khai window.api — danh sách kênh IPC có kiểu, KHÔNG lộ ipcRenderer thô.
const api: Api = {
  layTrangThai: () => ipcRenderer.invoke('trang-thai'),
  layNhanVien: () => ipcRenderer.invoke('nhan-vien:danh-sach'),
  chonVaNapFileMay: () => ipcRenderer.invoke('file-may:chon-va-nap'),
  themSuaNhanVien: (nv) => ipcRenderer.invoke('nhan-vien:them-sua', nv),
  xoaNhanVien: (p) => ipcRenderer.invoke('nhan-vien:xoa', p),
  napNhanVienTuFileKyTruoc: () => ipcRenderer.invoke('nhan-vien:nap-tu-file-ky-truoc'),
  layKyHienTai: () => ipcRenderer.invoke('ky-cong:hien-tai'),
  tinhLaiNgay: (payload) => ipcRenderer.invoke('ky-cong:tinh-lai-ngay', payload),
  chonThuMucVaXuat: (payload) => ipcRenderer.invoke('ky-cong:xuat', payload),
  moThuMuc: (duongDan) => ipcRenderer.invoke('mo-thu-muc', duongDan),
  moGopY: () => ipcRenderer.invoke('mo-gop-y'),
  danhDauXemCong: () => ipcRenderer.invoke('ky-cong:danh-dau-xem-cong'),

  // Vòng 3
  luuKy: (payload) => ipcRenderer.invoke('ky-cong:luu-ky', payload),
  danhSachKy: () => ipcRenderer.invoke('ky-luu:danh-sach'),
  docKy: (thang) => ipcRenderer.invoke('ky-luu:doc', thang),
  capNhatPhatLuong: (payload) => ipcRenderer.invoke('ky-luu:cap-nhat-phat-luong', payload),
  danhDauInDanhSach: (payload) => ipcRenderer.invoke('ky-luu:danh-dau-in', payload),

  // Vòng 4
  layHienThi: () => ipcRenderer.invoke('hien-thi:doc'),
  capNhatHienThi: (patch) => ipcRenderer.invoke('hien-thi:cap-nhat', patch),

  // Vòng 5
  layCauHinhMay: () => ipcRenderer.invoke('may-cham-cong:doc-cau-hinh'),
  capNhatCauHinhMay: (patch) => ipcRenderer.invoke('may-cham-cong:cap-nhat-cau-hinh', patch),
  dongBoTuMay: (payload) => ipcRenderer.invoke('may-cham-cong:dong-bo', payload)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error dev fallback
  window.api = api
}
