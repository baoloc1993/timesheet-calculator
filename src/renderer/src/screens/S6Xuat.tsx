import { useState } from 'react'
import { useApp } from '../store'
import type { XuatKetQua } from '../../../preload/api-types'

export function S6Xuat() {
  const { ky, trangThai, di, lamMoiTrangThai } = useApp()
  const [fileMau, setFileMau] = useState(trangThai?.fileMauBangLuongGanNhat ?? '')
  const [dangGhi, setDangGhi] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [trung, setTrung] = useState<string[] | null>(null)
  const [xong, setXong] = useState<XuatKetQua | null>(null)

  if (!ky) {
    return (
      <>
        <h1>Xuất kết quả</h1>
        <div className="card">
          <div className="empty">
            <p>Chưa nạp kỳ công.</p>
            <button className="btn primary" onClick={() => di('s1')}>
              Nạp file
            </button>
          </div>
        </div>
      </>
    )
  }

  const t = ky.thang.slice(-2)
  const tenBL = `bang luong thang ${t}.xlsx`
  const tenCT = `chi tiet cong thang ${t} (da lam sach).xlsx`

  async function chonMau() {
    const r = await window.api.chonFileMauBangLuong()
    if (r.ok && r.data) {
      setFileMau(r.data.duongDan)
      setLoi(null)
    }
  }

  async function xuat(ghiDe: boolean) {
    setLoi(null)
    setTrung(null)
    setDangGhi(true)
    try {
      const r = await window.api.chonThuMucVaXuat({ ghiDe })
      if (r.canXacNhanGhiDe) {
        setTrung(r.canXacNhanGhiDe)
        return
      }
      if (!r.ok || !r.data) {
        if (r.loi && r.loi !== 'Đã huỷ chọn thư mục.') setLoi(r.loi)
        return
      }
      setXong(r.data)
      await lamMoiTrangThai()
    } finally {
      setDangGhi(false)
    }
  }

  return (
    <>
      <h1>
        Xuất kết quả <span className="sub">kỳ {ky.thang} · đường phụ — chỉ cần xem thì mở Xem công</span>
      </h1>

      <div className="card">
        <p className="note" style={{ marginTop: 0 }}>
          Chỉ cần xem số để đối chiếu / duyệt lương thì mở{' '}
          <button className="lien-ket" style={{ padding: 0 }} onClick={() => di('s7')}>
            Xem công / bảng lương
          </button>
          , không phải xuất file. Xuất Excel khi cần file gửi đi.
        </p>

        <div className="kv">
          <span className="k">File 1</span>
          <span>{tenBL}</span>
        </div>
        <div className="kv">
          <span className="k">File 2</span>
          <span>{tenCT}</span>
        </div>

        <div className="field" style={{ marginTop: 'var(--space-lg)' }}>
          <label>File mẫu bảng lương (thường là kỳ trước)</label>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="btn" onClick={chonMau}>
              {fileMau ? 'Đổi file mẫu' : 'Chọn file mẫu'}
            </button>
            <span className="muted small" style={{ alignSelf: 'center' }}>
              {fileMau || 'chưa chọn — bắt buộc để xuất bảng lương'}
            </span>
          </div>
        </div>

        {trung && (
          <div className="errorbox" style={{ margin: 'var(--space-lg) 0' }}>
            <strong>File đã tồn tại: {trung.join(', ')}.</strong>
            <p className="small">Ghi đè sẽ mất nội dung file cũ.</p>
            <div className="toolbar" style={{ marginTop: 'var(--space-sm)', marginBottom: 0 }}>
              <button className="btn primary" onClick={() => xuat(true)}>
                Xác nhận ghi đè &amp; Xuất
              </button>
              <button className="btn" onClick={() => setTrung(null)}>
                Huỷ
              </button>
            </div>
          </div>
        )}

        {loi && (
          <div className="errorbox" style={{ margin: 'var(--space-lg) 0' }}>
            <strong>Không ghi được file.</strong>
            <p className="small">{loi}</p>
            <button className="btn" onClick={() => xuat(false)}>
              Thử lại
            </button>
          </div>
        )}

        {dangGhi && (
          <>
            <p className="loading">Đang ghi 2 file…</p>
            <div className="progress">
              <span />
            </div>
          </>
        )}

        {xong ? (
          <div className="empty">
            <p>
              Đã xuất 2 file vào {xong.thuMuc}.<br />
              Bảng lương: {xong.bangLuong.daGhi} thẻ điền
              {xong.bangLuong.khongKhop.length > 0 &&
                ` · ${xong.bangLuong.khongKhop.length} nhân viên trong kỳ không tìm thấy thẻ: ${xong.bangLuong.khongKhop.join(', ')}`}
              . Chi tiết: {xong.chiTiet.soDongToVang} dòng tô vàng.
            </p>
            {xong.bangLuong.theGiuSoCu.length > 0 && (
              <p className="note" role="status">
                ⚠ {xong.bangLuong.theGiuSoCu.length} thẻ trong file mẫu <strong>không được cập nhật</strong> kỳ
                này (nhân viên không có trong kỳ) — vẫn giữ số ngày/giờ kỳ trước, kiểm tay:{' '}
                {xong.bangLuong.theGiuSoCu.join(', ')}.
              </p>
            )}
            <button className="btn primary" onClick={() => window.api.moThuMuc(xong.thuMuc)}>
              Mở thư mục
            </button>
            <button className="btn" onClick={() => di('s2')}>
              Về bảng tổng hợp
            </button>
          </div>
        ) : (
          !trung && (
            <div className="toolbar" style={{ marginTop: 'var(--space-lg)', marginBottom: 0 }}>
              <button
                className="btn primary"
                disabled={!fileMau || dangGhi}
                aria-busy={dangGhi}
                onClick={() => xuat(false)}
              >
                Chọn thư mục &amp; Xuất
              </button>
            </div>
          )
        )}
      </div>
    </>
  )
}
