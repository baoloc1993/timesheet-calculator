import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import type { NhanVien, LoiTruongForm } from '../../../preload/api-types'

type Form = {
  id?: string
  maNhanVien: string
  tenMay: string
  tenBangLuong: string
  nguongGioChuanNgay: string
  donGiaNgay: string
  donGiaGioOT: string
}

const RONG: Form = {
  maNhanVien: '',
  tenMay: '',
  tenBangLuong: '',
  nguongGioChuanNgay: '8.1',
  donGiaNgay: '',
  donGiaGioOT: ''
}

export function S5Setup() {
  const { nhanVien, ky, di, lamMoiNhanVien, lamMoiTrangThai, datKy } = useApp()
  const [form, setForm] = useState<Form | null>(null)
  const [loiTruong, setLoiTruong] = useState<LoiTruongForm[]>([])
  const [thongBao, setThongBao] = useState<string | null>(null)
  const [dangNap, setDangNap] = useState(false)

  const thieu = useMemo(() => ky?.thieuSetup ?? [], [ky])

  // đang trong luồng "khai nhân viên thiếu" → tự mở form prefilled người đầu tiên
  useEffect(() => {
    if (thieu.length > 0 && !form) {
      setForm({ ...RONG, maNhanVien: thieu[0].maNhanVien, tenMay: thieu[0].tenMay })
    }
  }, [thieu, form])

  function sua(nv: NhanVien) {
    setLoiTruong([])
    setForm({
      id: nv.id,
      maNhanVien: nv.maNhanVien,
      tenMay: nv.tenMay,
      tenBangLuong: nv.tenBangLuong,
      nguongGioChuanNgay: String(nv.nguongGioChuanNgay),
      donGiaNgay: String(nv.donGiaNgay),
      donGiaGioOT: String(nv.donGiaGioOT)
    })
  }

  async function luu() {
    if (!form) return
    setLoiTruong([])
    setThongBao(null)
    const r = await window.api.themSuaNhanVien({
      id: form.id,
      maNhanVien: form.maNhanVien.trim(),
      tenMay: form.tenMay.trim(),
      tenBangLuong: form.tenBangLuong.trim() || form.tenMay.trim(),
      nguongGioChuanNgay: Number(form.nguongGioChuanNgay),
      donGiaNgay: Number(form.donGiaNgay || 0),
      donGiaGioOT: Number(form.donGiaGioOT || 0)
    })
    if (!r.ok) {
      setLoiTruong(r.loiTruong ?? [])
      if (!r.loiTruong?.length && r.loi) setThongBao(r.loi)
      return
    }
    await lamMoiNhanVien()
    await lamMoiTrangThai()
    if (r.ky !== undefined) datKy(r.ky ?? null)

    const conThieu = r.ky?.thieuSetup ?? []
    if (conThieu.length > 0) {
      setForm({ ...RONG, maNhanVien: conThieu[0].maNhanVien, tenMay: conThieu[0].tenMay })
      setThongBao(`Đã lưu. Còn ${conThieu.length} nhân viên chưa khai.`)
    } else if (thieu.length > 0) {
      // vừa khai xong người cuối của luồng chặn → về bảng tổng hợp
      di('s2')
    } else {
      setForm(null)
      setThongBao('Đã lưu.')
    }
  }

  async function xoa(nv: NhanVien) {
    const r = await window.api.xoaNhanVien(nv.id)
    if (r.ok) {
      await lamMoiNhanVien()
      await lamMoiTrangThai()
      if (r.ky !== undefined) datKy(r.ky ?? null)
      if (form?.id === nv.id) setForm(null)
    }
  }

  async function napTuFile() {
    setDangNap(true)
    setThongBao(null)
    try {
      const r = await window.api.napNhanVienTuFileKyTruoc()
      if (!r.ok) {
        if (r.loi && r.loi !== 'Đã huỷ chọn file.') setThongBao(r.loi)
        return
      }
      await lamMoiNhanVien()
      await lamMoiTrangThai()
      if (r.data) setThongBao(`Đã nạp — Setup hiện có ${r.data.length} nhân viên. Kiểm tra ngưỡng giờ chuẩn từng người.`)
    } finally {
      setDangNap(false)
    }
  }

  const err = (t: string) => loiTruong.find((l) => l.truong === t)?.thongBao

  return (
    <>
      <h1>Setup nhân viên</h1>

      <div className="card">
        <div className="toolbar">
          <button
            className="btn primary"
            onClick={() => {
              setLoiTruong([])
              setForm({ ...RONG })
            }}
          >
            Thêm nhân viên
          </button>
          <button className="btn" aria-busy={dangNap} disabled={dangNap} onClick={napTuFile}>
            {dangNap ? 'Đang đọc file kỳ trước…' : 'Nạp từ file kỳ trước'}
          </button>
        </div>

        {thongBao && <p className="note">{thongBao}</p>}

        {nhanVien.length === 0 ? (
          <div className="empty">
            <p>Chưa khai nhân viên nào.</p>
            <button className="btn primary" onClick={() => setForm({ ...RONG })}>
              Thêm tay
            </button>
            <button className="btn" onClick={napTuFile}>
              Nạp từ file kỳ trước
            </button>
          </div>
        ) : (
          <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên trên file máy</th>
                <th>Tên trên bảng lương</th>
                <th className="num">Ngưỡng giờ/ngày</th>
                <th className="num">Đơn giá ngày</th>
                <th className="num">Đơn giá giờ OT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {nhanVien.map((nv) => (
                <tr
                  key={nv.id}
                  className={'row' + (form?.id === nv.id ? ' selected' : '')}
                  onClick={() => sua(nv)}
                >
                  <td>{nv.maNhanVien}</td>
                  <td>{nv.tenMay}</td>
                  <td>{nv.tenBangLuong}</td>
                  <td className="num">{nv.nguongGioChuanNgay}</td>
                  <td className="num">{nv.donGiaNgay.toLocaleString('vi-VN')}</td>
                  <td className="num">{nv.donGiaGioOT.toLocaleString('vi-VN')}</td>
                  <td>
                    <button
                      className="btn small"
                      onClick={(e) => {
                        e.stopPropagation()
                        xoa(nv)
                      }}
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {form && (
        <div className="card">
          <h2>{form.id ? `Sửa: ${form.maNhanVien} — ${form.tenMay}` : 'Thêm nhân viên'}</h2>
          <div className="grid2">
            <F label="Mã nhân viên" v={form.maNhanVien} e={err('maNhanVien')} on={(v) => setForm({ ...form, maNhanVien: v })} />
            <F label="Tên trên file máy" v={form.tenMay} e={err('tenMay')} on={(v) => setForm({ ...form, tenMay: v })} />
            <F label="Tên trên bảng lương" v={form.tenBangLuong} on={(v) => setForm({ ...form, tenBangLuong: v })} />
            <F label="Ngưỡng giờ chuẩn / ngày" v={form.nguongGioChuanNgay} e={err('nguongGioChuanNgay')} on={(v) => setForm({ ...form, nguongGioChuanNgay: v })} />
            <F label="Đơn giá ngày (VND)" v={form.donGiaNgay} e={err('donGiaNgay')} on={(v) => setForm({ ...form, donGiaNgay: v })} />
            <F label="Đơn giá giờ tăng ca (VND)" v={form.donGiaGioOT} e={err('donGiaGioOT')} on={(v) => setForm({ ...form, donGiaGioOT: v })} />
          </div>
          <div className="toolbar" style={{ marginTop: 'var(--space-md)', marginBottom: 0 }}>
            <button className="btn primary" onClick={luu}>
              Lưu
            </button>
            {thieu.length === 0 && (
              <button className="btn" onClick={() => setForm(null)}>
                Huỷ
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function F({
  label,
  v,
  e,
  on
}: {
  label: string
  v: string
  e?: string
  on: (v: string) => void
}) {
  return (
    <div className={'field' + (e ? ' invalid' : '')}>
      <label>{label}</label>
      <input value={v} onChange={(ev) => on(ev.target.value)} />
      {e && <span className="err">{e}</span>}
    </div>
  )
}
