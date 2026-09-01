// Hợp đồng IPC — dùng chung preload + renderer + main. Không import gì nặng.
import type {
  NhanVien,
  KetQuaKyCong,
  TongHopNhanVien,
  KetQuaNgay
} from '../core/types'

export type { NhanVien, KetQuaKyCong, TongHopNhanVien, KetQuaNgay }

export interface KetQua<T> {
  ok: boolean
  data?: T
  loi?: string
  maLoi?: string
}

export interface NapFileKetQua {
  ky: KetQuaKyCong
  fileMay: string
}

export interface TrangThaiApp {
  soNhanVien: number
  kyXuLyGanNhat: string
  thuMucXuatGanNhat: string
  fileMauBangLuongGanNhat: string
}

export interface LoiTruongForm {
  truong: string
  thongBao: string
}

export interface XuatKetQua {
  bangLuong: { duongDan: string; daGhi: number; khongKhop: string[]; theGiuSoCu: string[] }
  chiTiet: { duongDan: string; soDongToVang: number }
  thuMuc: string
}

export interface XacNhanXoa {
  ten: string
  trongKy: boolean
  loi: string
}

export interface Api {
  layTrangThai(): Promise<TrangThaiApp>
  layNhanVien(): Promise<NhanVien[]>
  chonVaNapFileMay(): Promise<KetQua<NapFileKetQua>>
  themSuaNhanVien(
    nv: Partial<NhanVien>
  ): Promise<
    KetQua<NhanVien[]> & { loiTruong?: LoiTruongForm[]; ky?: KetQuaKyCong | null; canhBaoLamMoi?: string }
  >
  xoaNhanVien(
    p: { id: string; xacNhan?: boolean }
  ): Promise<
    KetQua<NhanVien[]> & { ky?: KetQuaKyCong | null; canhBaoLamMoi?: string; canXacNhanXoa?: XacNhanXoa }
  >
  napNhanVienTuFileKyTruoc(): Promise<
    KetQua<NhanVien[]> & { ky?: KetQuaKyCong | null; canhBaoLamMoi?: string }
  >
  chonFileMauBangLuong(): Promise<KetQua<{ duongDan: string }>>
  layKyHienTai(): Promise<KetQuaKyCong | null>
  tinhLaiNgay(payload: {
    maNhanVien: string
    ngay: string
    cap: { vao: string | null; ra: string | null }[]
  }): Promise<KetQua<{ dong: KetQuaNgay; tongHop: TongHopNhanVien }>>
  chonThuMucVaXuat(payload: { ghiDe: boolean }): Promise<
    KetQua<XuatKetQua> & { canXacNhanGhiDe?: string[] }
  >
  moThuMuc(duongDan: string): Promise<void>
  /** Mở trình gửi mail tới địa chỉ góp ý. */
  moGopY(): Promise<void>
  /**
   * Ghi mốc "đã xem kết quả trong app" vào log cục bộ ( 4,
   * success metric vòng 2 — đọc công trong app thay vì mở Excel). Fire-and-forget.
   */
  danhDauXemCong(): Promise<void>
}
