import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../store'
import { dmy } from '../App'
import { PageHead } from '../components/PageHead'
import type { KetQuaKy, NguoiPhat } from '../../../preload/api-types'
import { docSoTienBangChu, dsNguoiPhat } from '../../../preload/api-types'

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const so2 = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Phieu({ kq, p }: { kq: KetQuaKy; p: NguoiPhat }) {
  return (
    <div className="phieu">
      <div className="ph-top">
        <span className="ph-ky">PHIẾU LƯƠNG KỲ {kq.thang}</span>
        <span className="ph-xuong">
          {dmy(kq.khoangNgay.tu)} – {dmy(kq.khoangNgay.den)}
        </span>
      </div>
      <div>
        <div className="ph-ten">{p.d.tenBangLuong}</div>
        <div className="ph-ma">mã {p.d.maNhanVien}</div>
        <table>
          <tbody>
            {!p.coDonGia ? (
              <tr>
                <td>Thành tiền</td>
                <td className="c"></td>
                <td className="v">{vnd(p.d.thanhTien)}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td>Ngày công</td>
                  <td className="c">
                    {so2(p.d.ngayCong)} công × {vnd(p.d.donGiaNgay ?? 0)}
                  </td>
                  <td className="v">{vnd(p.luongCong)}</td>
                </tr>
                <tr>
                  <td>Tăng ca</td>
                  <td className="c">
                    {so2(p.d.gioOT)} giờ × {vnd(p.d.donGiaGioOT ?? 0)}
                  </td>
                  <td className="v">{vnd(p.tienOt)}</td>
                </tr>
              </>
            )}
            {p.chuyenCan > 0 && (
              <tr>
                <td>Chuyên cần</td>
                <td className="c"></td>
                <td className="v">{vnd(p.chuyenCan)}</td>
              </tr>
            )}
            {p.buLuong > 0 && (
              <tr>
                <td>Bù lương</td>
                <td className="c"></td>
                <td className="v">{vnd(p.buLuong)}</td>
              </tr>
            )}
            {p.le > 0 && (
              <tr>
                <td>Lễ</td>
                <td className="c"></td>
                <td className="v">{vnd(p.le)}</td>
              </tr>
            )}
            {p.coDonGia && (
              <tr className="tong">
                <td>Tổng</td>
                <td className="c"></td>
                <td className="v">{vnd(p.tho + p.chuyenCan + p.buLuong + p.le)}</td>
              </tr>
            )}
            {p.baoHiem > 0 && (
              <tr>
                <td className="tru">Trừ bảo hiểm</td>
                <td className="c"></td>
                <td className="v">−{vnd(p.baoHiem)}</td>
              </tr>
            )}
            {p.khauTru > 0 && (
              <tr>
                <td className="tru">Trừ vay</td>
                <td className="c">đã ứng trong tháng</td>
                <td className="v">−{vnd(p.khauTru)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="ph-right">
        <div className="ph-net">
          <div className="k">THỰC NHẬN</div>
          <div className="v">{vnd(p.thucNhan)}</div>
        </div>
        <div className="ph-chu">Bằng chữ: {docSoTienBangChu(p.thucNhan)}</div>
        <div className="ph-ky2">
          Ngày <span className="dot" style={{ minWidth: '8mm' }}></span> tháng{' '}
          <span className="dot" style={{ minWidth: '8mm' }}></span> năm {kq.thang.slice(0, 4)}
          <br />
          Người nhận ký: <span className="dot"></span>
        </div>
      </div>
      <span className="cut">✂ cắt theo đường này</span>
    </div>
  )
}

export function S13InPhieuLuong() {
  const { thangDangXem, di, inPhieuMa, moInPhieu } = useApp()
  const [kq, setKq] = useState<KetQuaKy | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [chiChuaNhan, setChiChuaNhan] = useState(false)

  const nap = useCallback(async () => {
    if (!thangDangXem) {
      setKq(null)
      setDangTai(false)
      return
    }
    setDangTai(true)
    setKq(await window.api.docKy(thangDangXem))
    setDangTai(false)
  }, [thangDangXem])

  useEffect(() => {
    nap()
  }, [nap])

  const ds: NguoiPhat[] = useMemo(() => (kq ? dsNguoiPhat(kq) : []), [kq])

  const danhSachIn = useMemo(() => {
    if (inPhieuMa) return ds.filter((p) => p.d.maNhanVien === inPhieuMa && !p.chan)
    return ds.filter((p) => !p.chan && (!chiChuaNhan || !p.daTra))
  }, [ds, inPhieuMa, chiChuaNhan])

  const to: NguoiPhat[][] = []
  for (let i = 0; i < danhSachIn.length; i += 3) to.push(danhSachIn.slice(i, i + 3))

  if (!thangDangXem) {
    return (
      <>
        <PageHead crumb="Phát lương" title="In phiếu lương" />
        <div className="page-body">
          <div className="card">
            <div className="empty">
              <p>Chọn một kỳ đã lưu ở Dashboard, hoặc lưu kỳ đang tính trước.</p>
              <button className="btn primary" onClick={() => di('s9')}>
                Về Dashboard
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (dangTai || !kq) {
    return (
      <>
        <PageHead crumb="Phát lương" title="In phiếu lương" />
        <div className="page-body">
          <p className="loading">{dangTai ? 'Đang tải kỳ…' : `Không tìm thấy kỳ ${thangDangXem} đã lưu.`}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHead
        crumb="Phát từng người"
        title="In phiếu lương"
        sub={
          <>
            kỳ {kq.thang} · 3 phiếu một tờ A4, cắt ngang hai nhát
            {inPhieuMa && ` · in riêng cho ${danhSachIn[0]?.d.tenBangLuong ?? inPhieuMa}`}
          </>
        }
        actions={
          <>
            <button className="btn" onClick={() => di('s12')}>
              ‹ Về danh sách phát
            </button>
            <button
              className="btn primary"
              disabled={danhSachIn.length === 0}
              onClick={() => window.print()}
            >
              ⎙ In
            </button>
          </>
        }
      />
      <div className="page-body">
        {!inPhieuMa && (
          <div className="sheetbar">
            <span className="lb">In cho:</span>
            <div className="seg" role="group" aria-label="Chọn người in phiếu">
              <button aria-pressed={!chiChuaNhan} onClick={() => setChiChuaNhan(false)}>
                Tất cả
              </button>
              <button aria-pressed={chiChuaNhan} onClick={() => setChiChuaNhan(true)}>
                Chỉ người chưa nhận
              </button>
            </div>
            <span style={{ flex: 1 }}></span>
            <span className="small muted">
              {danhSachIn.length} phiếu · {to.length} tờ A4
            </span>
          </div>
        )}
        {inPhieuMa && (
          <p className="toolbar">
            <button className="btn small" onClick={() => moInPhieu(null)}>
              Bỏ lọc, quay về in theo danh sách
            </button>
          </p>
        )}

        {danhSachIn.length === 0 ? (
          <div className="card">
            <div className="empty">
              <p>Không còn ai để in phiếu — mọi người trong danh sách đã nhận lương rồi.</p>
            </div>
          </div>
        ) : (
          <div className="sheetstage">
            {to.map((ba, i) => (
              <div className="sheet" key={i}>
                <span className="pgno">Tờ {i + 1}</span>
                {ba.map((p) => (
                  <Phieu key={p.d.maNhanVien} kq={kq} p={p} />
                ))}
                {Array.from({ length: 3 - ba.length }, (_, k) => (
                  <div className="phieu trong" key={'trong' + k}></div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bản in phiếu — tách khỏi .printsheet bằng class riêng, không đè khổ giấy. */}
      <div className="phieusheet" aria-hidden="true">
        {to.map((ba, i) => (
          <div className="sheet" key={i}>
            {ba.map((p) => (
              <Phieu key={p.d.maNhanVien} kq={kq} p={p} />
            ))}
            {Array.from({ length: 3 - ba.length }, (_, k) => (
              <div className="phieu trong" key={'trong' + k}></div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
