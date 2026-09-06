import { useEffect, useMemo } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import { chonKyMacDinh } from '../../../preload/api-types'

const so2 = (n: number) => Math.round(n * 100) / 100
const vnd = (n: number) => n.toLocaleString('vi-VN')

export function S7XemCong() {
  const { ky, di, xemChamCongGoc, danhSachKy, moKy } = useApp()

  // Vòng 7 (AC-4) — S7 chỉ biết hiện kỳ ĐANG MỞ trong bộ nhớ, không có model cho kỳ đã
  // lưu. Quy tắc ngày-trong-tháng chỉ ra một kỳ ĐÃ LƯU → không tự vẽ lại ở đây (thiếu dữ
  // liệu chi tiết), chuyển sang Dashboard (S9) đã hiển thị đúng kỳ đó thay (tái dùng UI,
  // không thêm state/IPC mới). Xem cho lý do chọn hướng này.
  const macDinh = useMemo(
    () => chonKyMacDinh(danhSachKy.map((k) => k.thang), new Date(), !!ky),
    [danhSachKy, ky]
  )

  useEffect(() => {
    if (macDinh.loai === 'da-luu') {
      moKy(macDinh.thang)
      di('s9')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macDinh])

  // Mốc "đọc kết quả kỳ trong app" — success metric vòng 2.
  const sanSang = !!ky && ky.thieuSetup.length === 0
  useEffect(() => {
    if (sanSang) window.api.danhDauXemCong()
  }, [sanSang, ky?.thang])

  if (macDinh.loai === 'da-luu') {
    return null // đang chuyển sang Dashboard hiện đúng kỳ (vòng 7, AC-4)
  }

  if (!ky) {
    return (
      <>
        <PageHead crumb="Kỳ hiện tại" title="Xem công / bảng lương" />
        <div className="page-body">
        <div className="card">
          <div className="empty">
            <p>Chưa nạp kỳ công nào — nạp file ở màn Nạp file.</p>
            <button className="btn primary" onClick={() => di('s1')}>
              Sang màn Nạp file
            </button>
          </div>
        </div>
        </div>
      </>
    )
  }

  if (ky.thieuSetup.length > 0) {
    return (
      <>
        <PageHead crumb="Kỳ hiện tại" title="Xem công / bảng lương" />
        <div className="page-body">
        <div className="card">
          <div className="errorbox">
            <strong>{ky.thieuSetup.length} nhân viên trong file máy chưa khai Setup.</strong>
            <p className="small">
              Thành tiền chưa đủ tới khi khai xong ngưỡng giờ + đơn giá cho họ.
            </p>
            <button className="btn" onClick={() => di('s4')}>
              Xem danh sách thiếu Setup
            </button>
          </div>
        </div>
        </div>
      </>
    )
  }

  const chuaKhaiDonGia = ky.tongHop.filter((t) => t.donGiaNgay === 0 || t.donGiaGioOT === 0)

  return (
    <>
      <PageHead
        crumb="Kỳ hiện tại"
        title="Xem công / bảng lương"
        sub={
          <>
            kỳ {ky.thang} · {dmy(ky.ngayBatDau)} – {dmy(ky.ngayKetThuc)} · {ky.tongHop.length} nhân
            viên · không cần xuất Excel
          </>
        }
        actions={
          <button className="btn" onClick={() => di('s6')}>
            Xuất Excel (tuỳ chọn)
          </button>
        }
      />
      <div className="page-body">

      {chuaKhaiDonGia.length > 0 && (
        <p className="note" role="status">
          ⚠ {chuaKhaiDonGia.length} nhân viên chưa khai đủ đơn giá (ngày hoặc giờ OT ={' '}
          <strong>0</strong>) — thành tiền của họ <strong>chưa đủ</strong> và tổng kỳ đang
          thiếu phần đó: {chuaKhaiDonGia.map((t) => t.tenBangLuong || t.tenMay).join(', ')}. Khai
          đơn giá ở màn Setup nhân viên.
        </p>
      )}

      <div className="stats">
        <div className="stat">
          <div className="num">{so2(ky.tongNgayCongCaKy)}</div>
          <div className="label">Tổng ngày công</div>
        </div>
        <div className="stat">
          <div className="num">{so2(ky.tongGioOTCaKy)}</div>
          <div className="label">Tổng giờ tăng ca</div>
        </div>
        <div className="stat">
          <div className="num">{vnd(ky.tongThanhTienCaKy)}</div>
          <div className="label">Tổng thành tiền kỳ (VND)</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th className="num">Ngày công</th>
                <th className="num">Giờ OT</th>
                <th className="num">Đơn giá ngày</th>
                <th className="num">Đơn giá OT</th>
                <th className="num">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {ky.tongHop.map((t) => (
                <tr
                  key={t.maNhanVien}
                  className="row"
                  onClick={() => xemChamCongGoc(t.maNhanVien)}
                >
                  <td>
                    {t.tenBangLuong || t.tenMay}
                    <span className="muted small"> · {t.tenMay}</span>
                  </td>
                  <td className="num">{so2(t.tongNgayCong)}</td>
                  <td className="num">{so2(t.tongGioOT)}</td>
                  <td className="num">{vnd(t.donGiaNgay)}</td>
                  <td className="num">{vnd(t.donGiaGioOT)}</td>
                  <td className="num">
                    {vnd(t.thanhTien)}
                    {(t.donGiaNgay === 0 || t.donGiaGioOT === 0) && (
                      <span className="muted small"> ⚠ thiếu đơn giá</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td>Tổng cộng kỳ</td>
                <td className="num">{so2(ky.tongNgayCongCaKy)}</td>
                <td className="num">{so2(ky.tongGioOTCaKy)}</td>
                <td className="num">—</td>
                <td className="num">—</td>
                <td className="num big">{vnd(ky.tongThanhTienCaKy)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="note">
          Bấm một nhân viên để xem chấm công gốc và Q/R/S từng ngày. Thành tiền = ngày công ×
          đơn giá ngày + giờ OT × đơn giá OT; chưa gồm chuyên cần / bù lương / lễ / bảo hiểm /
          vay.
        </p>
      </div>
      </div>
    </>
  )
}
