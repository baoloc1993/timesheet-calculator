// Vòng 7 — chọn kỳ mặc định để mở khi vào S7/S9, theo ngày-trong-tháng (AC-4).
// Hàm thuần: không đổi thứ tự danh sách kỳ, chỉ trả về kỳ nào nên MỞ SẴN lúc vừa vào màn.

export type KyMacDinh = { loai: 'dang-mo' } | { loai: 'da-luu'; thang: string } | { loai: 'khong-co' }

function thangIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * ngày ≤ 5 (đầu tháng) → kỳ đã lưu gần nhất TRƯỚC tháng hiện tại (nếu có).
 * ngày > 5 → kỳ đang mở nếu có, else kỳ đã lưu khớp ĐÚNG tháng hiện tại.
 * Không có gì khớp → 'khong-co' (bên gọi giữ khuôn rỗng/mặc định cũ, không tự tạo kỳ).
 */
export function chonKyMacDinh(
  danhSachThangDaLuu: string[],
  ngayHomNay: Date,
  coKyDangMo: boolean
): KyMacDinh {
  const thangHienTai = thangIso(ngayHomNay)
  if (ngayHomNay.getDate() <= 5) {
    const truoc = danhSachThangDaLuu
      .filter((t) => t < thangHienTai)
      .sort()
      .at(-1)
    return truoc ? { loai: 'da-luu', thang: truoc } : { loai: 'khong-co' }
  }
  if (coKyDangMo) return { loai: 'dang-mo' }
  return danhSachThangDaLuu.includes(thangHienTai)
    ? { loai: 'da-luu', thang: thangHienTai }
    : { loai: 'khong-co' }
}
