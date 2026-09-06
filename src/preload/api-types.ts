// Hợp đồng IPC — dùng chung preload + renderer + main. Không import gì nặng.
import type {
  NhanVien,
  KetQuaKyCong,
  TongHopNhanVien,
  KetQuaNgay
} from '../core/types'
import type { KetQuaKy, DongBang } from '../core/ketQuaKy'
import type { HienThi } from '../core/hienThi'
import type { CauHinhMayChamCong } from '../core/mayChamCong'
import type { NguonGanNhat } from '../core/nguonGanNhat'

export type {
  NhanVien,
  KetQuaKyCong,
  TongHopNhanVien,
  KetQuaNgay,
  KetQuaKy,
  DongBang,
  HienThi,
  CauHinhMayChamCong,
  NguonGanNhat
}
export { chonKyMacDinh } from '../core/chonKy'
export type { KyMacDinh } from '../core/chonKy'
// Hàm thuần vòng 3 — renderer dùng để tính "thực nhận" / Σ mà không cần round-trip IPC.
export { tinhThucNhan, tinhThucNhanDayDu, lamTronNghin, tongKetQuaKy } from '../core/ketQuaKy'
export { dungKyHieuNgay, ngayLaChuNhat } from '../core/luoiCong'
export type { KyHieuNgay } from '../core/luoiCong'
export { docSoTienBangChu } from '../core/soTienBangChu'
export { dsNguoiPhat, dungNguoiPhat } from '../core/phatLuong'
export type { NguoiPhat } from '../core/phatLuong'

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
  /** != null khi migration config.json lỗi ở lần mở này và đã khôi phục `.bak`. */
  loiMigration?: string | null
}

export interface LoiTruongForm {
  truong: string
  thongBao: string
}

export interface XuatKetQua {
  bangLuong: {
    duongDan: string
    daGhi: number
    khongKhop: string[]
    theGiuSoCu: string[]
    theThemMoi: string[]
  }
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

  // ---- Vòng 3 — lưu kỳ + dashboard + phát lương ----
  /** Lưu kỳ đang tính vào lịch sử. `ghiDe` = xác nhận ghi đè kỳ đã tồn tại. */
  luuKy(payload: { ghiDe: boolean }): Promise<
    KetQua<KetQuaKy> & { canXacNhanGhiDe?: string }
  >
  /** Danh sách kỳ đã lưu, mới nhất trên đầu. */
  danhSachKy(): Promise<KetQuaKy[]>
  /** Một kỳ đã lưu theo `thang`. */
  docKy(thang: string): Promise<KetQuaKy | null>
  /** Cập nhật khấu trừ / trạng thái đã-trả / 4 khoản vòng 6 của MỘT nhân viên trong MỘT kỳ đã lưu. */
  capNhatPhatLuong(payload: {
    thang: string
    maNhanVien: string
    khauTru?: number
    daTra?: boolean
    chuyenCan?: number
    buLuong?: number
    le?: number
    baoHiem?: number
  }): Promise<KetQua<KetQuaKy>>
  /** Ghi mốc "đã in danh sách phát lương" vào log cục bộ (§Nhóm 4). Fire-and-forget. */
  danhDauInDanhSach(payload: { thang: string; soNguoi: number }): Promise<void>

  // ---- Vòng 4 — thiết lập Hiển thị ----
  /** Đọc `AppConfig.hienThi` (thiếu → mặc định tại code, không throw). */
  layHienThi(): Promise<HienThi>
  /** Ghi đè một phần thiết lập Hiển thị, trả về bộ đầy đủ đã chuẩn hoá. */
  capNhatHienThi(patch: Partial<HienThi>): Promise<HienThi>

  // ---- Vòng 5 — kết nối máy chấm công (LAN) ----
  /** Đọc `AppConfig.mayChamCong` (thiếu → ip rỗng/cổng 4370 tại code, không throw). */
  layCauHinhMay(): Promise<CauHinhMayChamCong>
  /** Ghi đè một phần cấu hình kết nối máy, trả về bộ đầy đủ đã chuẩn hoá. */
  capNhatCauHinhMay(patch: Partial<CauHinhMayChamCong>): Promise<CauHinhMayChamCong>
  /** Kết nối máy qua LAN, lấy log trong khoảng ngày ["YYYY-MM-DD", "YYYY-MM-DD"], gom + tính công. */
  dongBoTuMay(payload: { ip: string; port: number; tu: string; den: string }): Promise<
    KetQua<NapFileKetQua> & { canhBao?: string[] }
  >

  // ---- Vòng 7 — tự động nạp/đồng bộ nguồn gần nhất khi mở app (AC-1) ----
  /** Đọc `AppConfig.nguonGanNhat` (null nếu chưa từng nạp/đồng bộ lần nào). */
  layNguonGanNhat(): Promise<NguonGanNhat | null>
  /** Main tự chạy lại đúng nguồn gần nhất (file hoặc máy). Không có nguồn / đang có kỳ mở dở → ok:false. */
  tuDongNapNguonGanNhat(): Promise<KetQua<NapFileKetQua>>
}
