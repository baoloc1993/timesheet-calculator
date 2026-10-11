import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { NapFileKetQua } from '../../../preload/api-types'
import { khoangNgayMacDinh } from '../../../preload/api-types'

// segment "Chọn file" / "Đồng bộ từ máy" thêm cạnh luồng cũ.
// khoảng ngày mặc định dùng chung `khoangNgayMacDinh` (core) — ngày≤5 tự lấy
// tháng trước, thay vì luôn tháng hiện tại.

export function S1NapFile() {
  const { trangThai, di, datKy, lamMoiTrangThai } = useApp()
  const [dangNap, setDangNap] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  const [nguon, setNguon] = useState<'file' | 'may'>('file')
  const [ip, setIp] = useState('')
  const [port, setPort] = useState('4370')
  const [tu, setTu] = useState(() => khoangNgayMacDinh(new Date()).tu)
  const [den, setDen] = useState(() => khoangNgayMacDinh(new Date()).den)
  const [dangDongBo, setDangDongBo] = useState(false)
  const [loiMay, setLoiMay] = useState<string | null>(null)
  const [choXacNhan, setChoXacNhan] = useState<{ data: NapFileKetQua; canhBao: string[] } | null>(null)

  useEffect(() => {
    window.api.layCauHinhMay().then((c) => {
      if (c.ip) setIp(c.ip)
      if (c.port) setPort(String(c.port))
    })
  }, [])

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

  function xongDongBo(data: NapFileKetQua) {
    datKy(data.ky, data.fileMay)
    lamMoiTrangThai()
    di(data.ky.thieuSetup.length > 0 ? 's4' : 's2')
  }

  async function dongBoTuMay() {
    // hết cảnh báo "mất chỉnh sửa tay chưa lưu" — kỳ đang xử lý đã tự lưu liên tục
    // (`luuTuDong()`), đổi nguồn không còn mất gì.
    setLoiMay(null)
    setChoXacNhan(null)
    setDangDongBo(true)
    try {
      const r = await window.api.dongBoTuMay({ ip: ip.trim(), port: Number(port), tu, den })
      if (!r.ok || !r.data) {
        setLoiMay(r.loi || 'Không kết nối được máy chấm công.')
        return
      }
      if (r.canhBao?.length) {
        setChoXacNhan({ data: r.data, canhBao: r.canhBao })
      } else {
        xongDongBo(r.data)
      }
    } finally {
      setDangDongBo(false)
    }
  }

  const soNV = trangThai?.soNhanVien ?? 0
  const ipRong = ip.trim() === ''

  return (
    <>
      <PageHead
        crumb={
          <button className="lien-ket" onClick={() => di('s9')}>
            ← Dashboard
          </button>
        }
        title="Nạp file máy chấm công"
      />
      <div className="page-body">
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

      <div className="seg" role="group" aria-label="Nguồn dữ liệu" style={{ marginBottom: 'var(--space-lg)' }}>
        <button aria-pressed={nguon === 'file'} onClick={() => setNguon('file')}>
          Chọn file
        </button>
        <button aria-pressed={nguon === 'may'} onClick={() => setNguon('may')}>
          Đồng bộ từ máy
        </button>
      </div>

      {nguon === 'file' && (
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
      )}

      {nguon === 'may' && (
      <div className="card">
        <p className="note" role="status">
          Lấy log chấm công thẳng từ máy qua mạng LAN — cách nạp <strong>thêm</strong>, song song
          với &quot;Chọn file&quot;. Không đổi gì ở cách &quot;Chọn file&quot; cũ.
        </p>

        <div className="field">
          <label htmlFor="mcc-ip">Địa chỉ IP máy chấm công</label>
          <input
            id="mcc-ip"
            type="text"
            placeholder="vd: 192.0.2.201"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="mcc-port">Cổng</label>
          <input
            id="mcc-port"
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Khoảng ngày lấy dữ liệu</label>
          <div className="toolbar">
            <input type="date" value={tu} onChange={(e) => setTu(e.target.value)} />
            <span>đến</span>
            <input type="date" value={den} onChange={(e) => setDen(e.target.value)} />
          </div>
        </div>

        <div className="toolbar">
          <button
            className="btn primary"
            aria-busy={dangDongBo}
            disabled={dangDongBo || ipRong}
            onClick={dongBoTuMay}
          >
            {dangDongBo ? 'Đang kết nối…' : 'Kết nối & lấy dữ liệu'}
          </button>
          {ipRong && <span className="note" style={{ margin: 0 }}>Nhập địa chỉ máy trước</span>}
        </div>

        {choXacNhan && (
          <p className="note" role="status">
            <strong>{choXacNhan.canhBao.length} cảnh báo khi gom dữ liệu:</strong>{' '}
            {choXacNhan.canhBao.join('; ')}
            <br />
            <button className="btn small" onClick={() => xongDongBo(choXacNhan.data)} style={{ marginTop: 'var(--space-sm)' }}>
              Đã hiểu, tiếp tục
            </button>
          </p>
        )}

        {loiMay && (
          <div className="errorbox">
            <strong>Không kết nối được máy chấm công.</strong>
            <p className="small">{loiMay}</p>
            <button className="btn" onClick={dongBoTuMay}>
              Thử lại
            </button>
            <button className="btn" onClick={() => setNguon('file')}>
              Dùng Chọn file
            </button>
          </div>
        )}
      </div>
      )}
      </div>
    </>
  )
}
