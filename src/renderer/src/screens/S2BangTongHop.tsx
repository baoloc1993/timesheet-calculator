import { useApp } from '../store'
import { dmy } from '../App'

export function S2BangTongHop() {
  const { ky, di, chonNhanVien } = useApp()

  if (!ky) {
    return (
      <>
        <h1>Bảng tổng hợp</h1>
        <div className="card">
          <div className="empty">
            <p>Chưa nạp file máy chấm công.</p>
            <button className="btn primary" onClick={() => di('s1')}>
              Nạp file để bắt đầu
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <h1>
        Bảng tổng hợp{' '}
        <span className="sub">
          kỳ {ky.thang} · {dmy(ky.ngayBatDau)} – {dmy(ky.ngayKetThuc)} · {ky.tongHop.length} nhân
          viên
        </span>
      </h1>

      {ky.thieuSetup.length > 0 && (
        <p className="note" role="status">
          ⚠ Số dưới đây <strong>chưa đủ</strong> — còn {ky.thieuSetup.length} nhân viên chưa
          khai Setup nên chưa được tính vào tổng kỳ.
        </p>
      )}

      <div className={'stats' + (ky.thieuSetup.length > 0 ? ' muted' : '')}>
        <div className="stat">
          <div className="num">{ky.tongNgayCongCaKy}</div>
          <div className="label">Tổng ngày công</div>
        </div>
        <div className="stat">
          <div className="num">{ky.tongGioOTCaKy}</div>
          <div className="label">Tổng giờ tăng ca</div>
        </div>
        <div className="stat">
          <div className={'num' + (ky.tongDongCanXemLai > 0 ? ' alert' : '')}>
            {ky.tongDongCanXemLai}
          </div>
          <div className="label">Dòng cần xem lại</div>
        </div>
      </div>

      {ky.thieuSetup.length > 0 && (
        <div className="card">
          <div className="errorbox">
            <strong>{ky.thieuSetup.length} nhân viên trong file máy chưa khai Setup.</strong>
            <p className="small">Chưa xuất được tới khi khai đủ thông số cho họ.</p>
            <button className="btn" onClick={() => di('s4')}>
              Xem danh sách thiếu Setup
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <button
            className="btn primary"
            disabled={ky.thieuSetup.length > 0}
            onClick={() => di('s6')}
          >
            Xuất 2 file
          </button>
        </div>

        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th className="num">Ngày công</th>
              <th className="num">Giờ tăng ca</th>
              <th className="num">Dòng cần xem lại</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ky.tongHop.map((t) => (
              <tr
                key={t.maNhanVien}
                className={'row' + (t.soDongCanXemLai > 0 ? ' fixed' : '')}
                onClick={() => chonNhanVien(t.maNhanVien)}
              >
                <td>
                  {t.tenMay}
                  <span className="muted small"> · {t.tenBangLuong}</span>
                </td>
                <td className="num">{t.tongNgayCong}</td>
                <td className="num">{t.tongGioOT}</td>
                <td className="num">{t.soDongCanXemLai}</td>
                <td>
                  {t.soDongCanXemLai > 0 && (
                    <span className="chip">đã sửa {t.soDongCanXemLai} dòng</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="note">
          Bấm một nhân viên để xem chi tiết theo ngày và các dòng công cụ đã tự sửa.
        </p>
      </div>
    </>
  )
}
