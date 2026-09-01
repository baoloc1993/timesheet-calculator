import { useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'

export function S1NapFile() {
  const { trangThai, di, datKy, lamMoiTrangThai } = useApp()
  const [dangNap, setDangNap] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  async function nap() {
    setLoi(null)
    setDangNap(true)
    try {
      const r = await window.api.chonVaNapFileMay()
      if (!r.ok || !r.data) {
        if (r.loi && r.loi !== 'Đã huỷ chọn file.') setLoi(r.loi)
        return
      }
      datKy(r.data.ky, r.data.fileMay)
      await lamMoiTrangThai()
      di(r.data.ky.thieuSetup.length > 0 ? 's4' : 's2')
    } finally {
      setDangNap(false)
    }
  }

  const soNV = trangThai?.soNhanVien ?? 0

  return (
    <>
      <h1>Nạp file máy chấm công</h1>

      <div className="stats">
        <div className="stat">
          <div className={'num' + (soNV === 0 ? ' alert' : '')}>{soNV}</div>
          <div className="label">Nhân viên đã khai trong Setup</div>
        </div>
        <div className="stat">
          <div className="num">{trangThai?.kyXuLyGanNhat || '—'}</div>
          <div className="label">Kỳ xử lý gần nhất</div>
        </div>
      </div>

      {soNV === 0 && (
        <div className="card">
          <div className="empty">
            <p>
              Chưa khai nhân viên nào trong Setup.<br />
              Thêm tay hoặc nạp từ file bảng lương kỳ trước. File máy vẫn nạp được, nhưng sẽ
              báo thiếu Setup toàn bộ.
            </p>
            <button className="btn" onClick={() => di('s5')}>
              Mở Setup nhân viên
            </button>
          </div>
        </div>
      )}

      {soNV > 0 && (
        <p className="note" style={{ marginTop: 0, marginBottom: 'var(--space-lg)' }}>
          Nạp file máy chấm công của tháng → app tính công + lương cho cả {soNV} nhân viên, rồi
          mở màn <strong>Xem công / bảng lương</strong> để xem ai bao nhiêu công, thành tiền
          bao nhiêu.
        </p>
      )}

      <div className="card">
        <div className="dropzone">
          Chọn file <strong>.xlsx</strong> do máy chấm công xuất ra (sheet &quot;Chi Tiet&quot;)
        </div>
        <div className="toolbar">
          <button
            className="btn primary"
            aria-busy={dangNap}
            disabled={dangNap}
            onClick={nap}
          >
            {dangNap ? 'Đang đọc file…' : 'Nạp file máy chấm công'}
          </button>
          <button className="btn" onClick={() => di('s5')}>
            Setup nhân viên
          </button>
        </div>

        {dangNap && (
          <>
            <p className="loading">Đang đọc file và tính công…</p>
            <div className="progress">
              <span />
            </div>
          </>
        )}

        {loi && (
          <div className="errorbox">
            <strong>Không đọc được file.</strong>
            <p className="small">{loi}</p>
            <button className="btn" onClick={nap}>
              Thử lại
            </button>
          </div>
        )}

        {trangThai?.thuMucXuatGanNhat && (
          <p className="note">
            Thư mục xuất gần nhất: {trangThai.thuMucXuatGanNhat}
            {trangThai.kyXuLyGanNhat && ` · kỳ ${dmy(trangThai.kyXuLyGanNhat + '-01')}`}
          </p>
        )}
      </div>
    </>
  )
}
