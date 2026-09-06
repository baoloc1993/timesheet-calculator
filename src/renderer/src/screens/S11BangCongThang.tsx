import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { PageHead } from '../components/PageHead'
import { dungKyHieuNgay, ngayLaChuNhat } from '../../../preload/api-types'
import type { KyHieuNgay } from '../../../preload/api-types'
import type { KetQuaNgay } from '../../../preload/api-types'

const so1 = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const THU_VIET = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

interface Nghia {
  chu: string
  cong: string
  luong: string
  khi: string
}
// Nguồn duy nhất cho nghĩa ký hiệu — lưới, chú giải, tooltip đều đọc từ đây.
// Rút gọn còn 4 ký hiệu — không phân loại lý do nghỉ.
const CHUGIAI: Record<KyHieuNgay, Nghia> = {
  X: { chu: 'Đủ công', cong: '1 công', luong: 'Có lương', khi: 'Đi làm đủ giờ chuẩn của ngày (ngưỡng khai trong Setup).' },
  '½': { chu: 'Nửa công', cong: '0,5 công', luong: 'Có lương nửa ngày', khi: 'Chỉ chấm một buổi, hoặc làm chưa quá nửa ngưỡng giờ.' },
  vang: { chu: 'Vắng', cong: '0 công', luong: 'Không lương', khi: 'Không chấm công ngày đó — không phân loại lý do.' },
  CN: { chu: 'Chủ Nhật', cong: '0 công', luong: 'Không tính', khi: 'Ngày nghỉ tuần theo lịch. Đi làm Chủ Nhật thì máy vẫn chấm công, ra X và tính OT như bình thường.' }
}
const MA_GON: Record<KyHieuNgay, string> = { X: 'X', '½': '½', vang: 'Vắng', CN: 'CN' }

function ngayTrongKy(tu: string, den: string): string[] {
  const out: string[] = []
  const [y0, m0, d0] = tu.split('-').map(Number)
  const [y1, m1, d1] = den.split('-').map(Number)
  const cur = new Date(Date.UTC(y0, m0 - 1, d0))
  const end = new Date(Date.UTC(y1, m1 - 1, d1))
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

export function S11BangCongThang() {
  const { ky, di, xemChamCongGoc } = useApp()
  const [chuDayDu, setChuDayDu] = useState(false)
  const [hoverMa, setHoverMa] = useState<KyHieuNgay | null>(null)

  const ngays = useMemo(() => (ky ? ngayTrongKy(ky.ngayBatDau, ky.ngayKetThuc) : []), [ky])

  if (!ky) {
    return (
      <>
        <PageHead crumb="Kỳ hiện tại" title="Bảng công cả tháng" />
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

  let soDaSua = 0
  const congTheoNgay: number[] = ngays.map(() => 0)
  const otTheoNgay: number[] = ngays.map(() => 0)

  const hang = ky.tongHop.map((t) => {
    const theoNgay = new Map<string, KetQuaNgay>(t.ketQuaNgay.map((d) => [d.ngay, d]))
    const o = ngays.map((ngay, i) => {
      const d = theoNgay.get(ngay)
      const isCN = ngayLaChuNhat(ngay)
      const ma = d ? dungKyHieuNgay(d.ngayCongR, isCN) : isCN ? 'CN' : 'vang'
      if (d?.ngayCongR) congTheoNgay[i] += d.ngayCongR
      if (d?.gioOtS) otTheoNgay[i] += d.gioOtS
      if (d?.daSua) soDaSua++
      return { ngay, ma, ot: d?.gioOtS || 0, daSua: !!d?.daSua }
    })
    return { t, o }
  })

  return (
    <>
      <PageHead
        crumb="Kỳ hiện tại"
        title="Bảng công cả tháng"
        sub={
          <>
            kỳ {ky.thang} · {ky.tongHop.length} nhân viên × {ngays.length} ngày
            {ky.thieuSetup.length > 0 && ` · ${ky.thieuSetup.length} người chưa khai Setup`}
          </>
        }
      />
      <div className="page-body">
        <div className="card flush">
          <div className="card-head">
            <h2>Lưới công</h2>
            <div className="right">
              <span className="small muted">Trong ô ghi:</span>
              <div className="seg" role="group" aria-label="Cách ghi trong ô">
                <button aria-pressed={!chuDayDu} onClick={() => setChuDayDu(false)}>
                  Ký hiệu
                </button>
                <button aria-pressed={chuDayDu} onClick={() => setChuDayDu(true)}>
                  Chữ đầy đủ
                </button>
              </div>
              <span className="chip">⚑ {soDaSua} ô đã sửa</span>
            </div>
          </div>
          <div className="gridwrap">
            <table className={'month' + (hoverMa ? ' dim' : '')}>
              <thead>
                <tr>
                  <th className="nameh">Nhân viên</th>
                  {ngays.map((ngay) => {
                    const d = Number(ngay.slice(8, 10))
                    const cn = ngayLaChuNhat(ngay)
                    return (
                      <th key={ngay} className={cn ? 'sun' : ''}>
                        {d}
                        <span className="dw">{THU_VIET[new Date(ngay + 'T00:00:00Z').getUTCDay()]}</span>
                      </th>
                    )
                  })}
                  <th className="sumh">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {hang.map(({ t, o }) => (
                  <tr key={t.maNhanVien}>
                    <td
                      className="namec"
                      style={{ cursor: 'pointer' }}
                      title={`Mở chấm công gốc của ${t.tenBangLuong || t.tenMay}`}
                      onClick={() => xemChamCongGoc(t.maNhanVien)}
                    >
                      {t.tenBangLuong || t.tenMay}
                      <span className="alias"> {t.tenMay}</span>
                    </td>
                    {o.map((c) => (
                      <td key={c.ngay}>
                        <button
                          className={'cellbtn' + (c.daSua ? ' c-F' : '') + (hoverMa === c.ma ? ' hi' : '')}
                          title={`${t.tenBangLuong || t.tenMay} · ngày ${c.ngay.slice(8, 10)}/${c.ngay.slice(5, 7)} — ${
                            CHUGIAI[c.ma].chu
                          } (${CHUGIAI[c.ma].cong}, ${CHUGIAI[c.ma].luong.toLowerCase()})${
                            c.ot ? ` · tăng ca ${so1(c.ot)} giờ` : ''
                          }${c.daSua ? ' · công cụ đã sửa mốc giờ' : ''}`}
                        >
                          {chuDayDu ? CHUGIAI[c.ma].chu : MA_GON[c.ma]}
                          {c.ot > 0 && <span className="ot">+{so1(c.ot).replace(',0', '')}</span>}
                        </button>
                      </td>
                    ))}
                    <td className="sumc">
                      {so1(t.tongNgayCong)}
                      <span className="oth">+{so1(t.tongGioOT)} giờ OT</span>
                    </td>
                  </tr>
                ))}
                {ky.thieuSetup.map((n) => (
                  <tr key={n.maNhanVien} className="locked">
                    <td className="namec">
                      {n.tenMay}
                      <span className="chip err"> ✕ chưa khai Setup</span>
                    </td>
                    <td className="lockc" colSpan={ngays.length}></td>
                    <td className="sumc muted">—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="namec">Tổng theo ngày</td>
                  {ngays.map((ngay, i) => (
                    <td key={ngay}>
                      {congTheoNgay[i] ? so1(congTheoNgay[i]).replace(',0', '') : <span className="muted">—</span>}
                      {otTheoNgay[i] > 0 && (
                        <span className="ot" style={{ display: 'block', fontSize: '10px', color: 'var(--color-primary)' }}>
                          +{so1(otTheoNgay[i]).replace(',0', '')}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="sumc">
                    {so1(ky.tongNgayCongCaKy)}
                    <span className="oth">+{so1(ky.tongGioOTCaKy)} giờ OT</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="card flush">
          <div className="card-head">
            <h2>Ý nghĩa từng ký hiệu</h2>
            <div className="right">
              <span className="small muted">Rê chuột vào một dòng để thấy ký hiệu đó nằm ở đâu trên lưới</span>
            </div>
          </div>
          <div className="card-body">
            <div className="table-wrap">
              <table className="lgtable">
                <thead>
                  <tr>
                    <th>Ký hiệu</th>
                    <th>Nghĩa</th>
                    <th className="num">Tính mấy công</th>
                    <th>Lương</th>
                    <th>Khi nào ghi mã này</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(CHUGIAI) as KyHieuNgay[]).map((k) => (
                    <tr key={k} onMouseEnter={() => setHoverMa(k)} onMouseLeave={() => setHoverMa(null)}>
                      <td className="lgk">
                        <span className="lgbox">{MA_GON[k]}</span>
                      </td>
                      <td>{CHUGIAI[k].chu}</td>
                      <td className="num">{CHUGIAI[k].cong}</td>
                      <td>{CHUGIAI[k].luong}</td>
                      <td className="small muted">{CHUGIAI[k].khi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lgextra">
              <div>
                <span className="lgbox c-F">X</span>
                <div>
                  <b>Ô đã sửa</b>
                  <span>
                    Mốc giờ ngày đó bị lỗi, công cụ đã tự sửa. Mở{' '}
                    <button className="lien-ket" onClick={() => di('s8')}>
                      Giải trình & sửa công
                    </button>{' '}
                    để soát lại.
                  </span>
                </div>
              </div>
              <div>
                <span className="lgbox">
                  <i className="lgot">+2</i>
                </span>
                <div>
                  <b>Số xanh trong ô</b>
                  <span>Giờ tăng ca của riêng ngày đó. Cộng cả tháng ra cột Tổng bên phải.</span>
                </div>
              </div>
              <div>
                <span className="lgbox lgdash"></span>
                <div>
                  <b>Hàng gạch chéo</b>
                  <span>Người có trong file máy nhưng chưa khai Setup — app không tính được, không bịa ra số.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
