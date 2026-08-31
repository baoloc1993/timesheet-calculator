import { useApp } from '../store'

export function S4ChanThieuSetup() {
  const { ky, di } = useApp()
  const thieu = ky?.thieuSetup ?? []

  return (
    <>
      <h1>Chưa thể tính — thiếu thông số nhân viên</h1>

      <div className="card">
        {thieu.length === 0 ? (
          <div className="empty">
            <p>Mọi nhân viên trong file máy đều đã khai Setup.</p>
            <button className="btn primary" onClick={() => di('s2')}>
              Về bảng tổng hợp
            </button>
          </div>
        ) : (
          <>
            <div className="errorbox">
              <strong>
                {thieu.length} nhân viên trong file máy chưa được khai trong Setup.
              </strong>
              <p className="small">
                Khai đủ ngưỡng giờ chuẩn và đơn giá cho họ rồi mới tính và xuất được.
              </p>
            </div>
            <ul className="danger-list">
              {thieu.map((t) => (
                <li key={t.maNhanVien}>
                  Mã {t.maNhanVien} — &quot;{t.tenMay}&quot; (tên trên file máy){' '}
                  <button className="btn" onClick={() => di('s5')}>
                    Khai thông số
                  </button>
                </li>
              ))}
            </ul>
            <p className="note">Khai xong tất cả → tự quay lại bảng tổng hợp.</p>
          </>
        )}
      </div>
    </>
  )
}
