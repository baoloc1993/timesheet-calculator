import { useApp } from '../store'
import { dmy } from '../App'

const so2 = (n: number) => Math.round(n * 100) / 100
const vnd = (n: number) => n.toLocaleString('vi-VN')

export function S7XemCong() {
  const { ky, di, xemChamCongGoc } = useApp()

  if (!ky) {
    return (
      <>
        <h1>Xem công / bảng lương</h1>
        <div className="card">
          <div className="empty">
            <p>Chưa nạp kỳ công nào — nạp file ở màn Nạp file.</p>
            <button className="btn primary" onClick={() => di('s1')}>
              Sang màn Nạp file
            </button>
          </div>
        </div>
      </>
    )
  }

  if (ky.thieuSetup.length > 0) {
    return (
      <>
        <h1>Xem công / bảng lương</h1>
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
      </>
    )
  }

  return (
    <>
      <h1>
        Xem công / bảng lương{' '}
        <span className="sub">
          kỳ {ky.thang} · {dmy(ky.ngayBatDau)} – {dmy(ky.ngayKetThuc)} · {ky.tongHop.length} nhân
          viên · không cần xuất Excel
        </span>
      </h1>

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
        <div className="toolbar">
          <button className="btn" onClick={() => di('s6')}>
            Xuất Excel (tuỳ chọn)
          </button>
        </div>

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
                  <td className="num">{vnd(t.thanhTien)}</td>
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
    </>
  )
}
