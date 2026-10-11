// Thành tiền một nhân viên trong kỳ — hàm thuần, dùng cho màn S7 (Xem công).
//
//   thành tiền = Σ ngày công × đơn giá ngày + Σ giờ OT × đơn giá giờ OT
//
// Dẫn xuất — KHÔNG ghi vào file bảng lương xuất (file giữ cột "Đơn giá" như,
// kế toán tự nhân). Chỉ hiển thị trong app.

const lam0 = (x: number) => Math.round(x)

export function tinhThanhTien(
  tongNgayCong: number,
  tongGioOT: number,
  donGiaNgay: number,
  donGiaGioOT: number
): number {
  return lam0(tongNgayCong * donGiaNgay + tongGioOT * donGiaGioOT)
}
