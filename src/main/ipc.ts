// Điều phối IPC + mở dialog chọn file/thư mục. Không nhúng logic tính — gọi xuống core/.

import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { basename, join, dirname } from 'path'
import { existsSync } from 'fs'
import type { KetQuaKyCong, NhanVien } from '../core/types'
import { xuLyKyCong, tinhLaiMotDong, tinhLaiTongHop, tongToanKy } from '../core/xuLyKyCong'
import { phutTrongNgay } from '../core/time'
import { docFileMay, LoiDocFileMay } from './excel/docFileMay'
import { docBangLuong, nhanVienTuBangLuong } from './excel/docBangLuong'
import { ghiBangLuong } from './excel/ghiBangLuong'
import { ghiChiTietDaLamSach } from './excel/ghiChiTietDaLamSach'
import { layNhanVien, layConfig, ghiConfig } from './settings/store'
import { themHoacSua, xoaNhanVien, tronTuFileKyTruoc } from './settings/nhanVien'
import { log } from './logger'

interface KyHienTai {
  fileMay: string
  ky: KetQuaKyCong
}

let kyHienTai: KyHienTai | null = null

function win(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
}

// Test seam (dogfood/e2e): Playwright không bấm được dialog OS gốc. Khi biến
// TSC_TEST_* được đặt, handler dùng luôn đường dẫn đó thay vì mở dialog.
// KHÔNG ảnh hưởng bản build phát hành (biến không bao giờ được đặt ở đó).
function duongDanTest(bien: string): string | null {
  // Guard: seam CHỈ sống trong bản chưa đóng gói (dev / harness). Bản .exe phát hành
  // luôn bỏ qua, kể cả khi biến TSC_TEST_* tình cờ có trong môi trường máy người dùng.
  if (app.isPackaged) return null
  const v = process.env[bien]
  return v && existsSync(v) ? v : null
}

function loi(e: unknown) {
  if (e instanceof LoiDocFileMay) return { ok: false, loi: e.message, maLoi: e.ma }
  const raw = (e as Error)?.message || ''
  log.error('IPC', raw || 'lỗi không xác định', (e as Error)?.stack || '')
  // Map lỗi Node thô sang câu tiếng Việt nói được phải làm gì (CONVENTIONS §5) —
  // không đẩy đường dẫn nội bộ / message hệ thống ra UI.
  let than = 'Có lỗi khi xử lý. Thử lại; nếu vẫn lỗi, gửi file log qua nút "Góp ý / báo lỗi".'
  if (/EBUSY|EPERM|resource busy|being used by another process/i.test(raw))
    than = 'File đang được mở ở chương trình khác (thường là Excel). Đóng file đó rồi thử lại.'
  else if (/EACCES|permission denied/i.test(raw))
    than = 'Không có quyền ghi vào thư mục đã chọn. Chọn thư mục khác.'
  else if (/ENOENT|no such file/i.test(raw))
    than = 'Không tìm thấy file — có thể đã bị di chuyển hoặc đổi tên. Chọn lại file.'
  else if (/ENOSPC|no space/i.test(raw)) than = 'Ổ đĩa đầy — dọn bớt dung lượng rồi thử lại.'
  return { ok: false, loi: than }
}

function tenFileXuat(thang: string) {
  const t = thang.replace('-', ' tháng ').slice(-2) || thang
  return {
    bangLuong: `bang luong thang ${t}.xlsx`,
    chiTiet: `chi tiet cong thang ${t} (da lam sach).xlsx`
  }
}

export function dangKyIpc(): void {
  ipcMain.handle('trang-thai', () => {
    const c = layConfig()
    return {
      soNhanVien: layNhanVien().length,
      kyXuLyGanNhat: c.kyXuLyGanNhat,
      thuMucXuatGanNhat: c.thuMucXuatGanNhat,
      fileMauBangLuongGanNhat: c.fileMauBangLuongGanNhat
    }
  })

  ipcMain.handle('nhan-vien:danh-sach', () => layNhanVien())

  ipcMain.handle('file-may:chon-va-nap', async () => {
    try {
      let duongDan = duongDanTest('TSC_TEST_FILE_MAY')
      if (!duongDan) {
        const w = win()
        const r = await dialog.showOpenDialog(w!, {
          title: 'Chọn file máy chấm công (.xlsx)',
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
          properties: ['openFile']
        })
        if (r.canceled || !r.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn file.' }
        duongDan = r.filePaths[0]
      }
      const file = await docFileMay(duongDan)
      const ky = xuLyKyCong(file, layNhanVien())
      kyHienTai = { fileMay: duongDan, ky }
      ghiConfig({ kyXuLyGanNhat: file.thang })
      log.info('nạp file máy', duongDan, `${file.khoi.length} khối`)
      log.event('nap-file-may', {
        thang: file.thang,
        soKhoi: file.khoi.length,
        thieuSetup: ky.thieuSetup.length,
        dongCanXemLai: ky.tongDongCanXemLai
      })
      return { ok: true, data: { ky, fileMay: duongDan } }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('nhan-vien:them-sua', async (_e, nv: Partial<NhanVien>) => {
    const r = themHoacSua(nv)
    if (!r.ok) return { ok: false, loi: 'Dữ liệu chưa hợp lệ.', loiTruong: r.loi }
    const lm = await lamMoiKyHienTai()
    return { ok: true, data: r.nhanVien, ky: layKyHienTai(), canhBaoLamMoi: lm.loi }
  })

  ipcMain.handle('nhan-vien:xoa', async (_e, p: { id: string; xacNhan?: boolean }) => {
    const nv = layNhanVien().find((n) => n.id === p.id)
    if (!nv) return { ok: false, loi: 'Không tìm thấy nhân viên.' }
    // Cảnh báo nếu người này đang có trong kỳ vừa nạp —
    // và luôn đòi xác nhận (xoá cứng, mất ngưỡng + đơn giá đã khai — BH-3).
    const trongKy = kyHienTai?.ky.tongHop.some((t) => t.maNhanVien === nv.maNhanVien)
    if (!p.xacNhan) {
      return {
        ok: false,
        canXacNhanXoa: {
          ten: nv.tenMay,
          trongKy: !!trongKy,
          loi: trongKy
            ? `"${nv.tenMay}" đang có trong kỳ vừa nạp. Xoá sẽ mất ngưỡng giờ + đơn giá đã khai và chặn xuất tới khi khai lại.`
            : `Xoá "${nv.tenMay}" khỏi Setup? Ngưỡng giờ + đơn giá đã khai sẽ mất.`
        }
      }
    }
    const ds = xoaNhanVien(p.id)
    const lm = await lamMoiKyHienTai()
    log.info('xoá nhân viên', nv.maNhanVien, nv.tenMay)
    return { ok: true, data: ds, ky: layKyHienTai(), canhBaoLamMoi: lm.loi }
  })

  ipcMain.handle('ky-cong:hien-tai', () => layKyHienTai())

  ipcMain.handle('nhan-vien:nap-tu-file-ky-truoc', async () => {
    try {
      let duongDan = duongDanTest('TSC_TEST_FILE_KY_TRUOC')
      if (!duongDan) {
        const w = win()
        const r = await dialog.showOpenDialog(w!, {
          title: 'Chọn file bảng lương kỳ trước',
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
          properties: ['openFile']
        })
        if (r.canceled || !r.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn file.' }
        duongDan = r.filePaths[0]
      }
      const { doc } = await docBangLuong(duongDan)
      const rut = nhanVienTuBangLuong(doc)
      if (rut.length === 0)
        return { ok: false, loi: 'Không rút được nhân viên nào từ file — kiểm tra đúng là file bảng lương.' }
      const ds = tronTuFileKyTruoc(rut)
      const lm = await lamMoiKyHienTai()
      log.info('nạp nhân viên từ file kỳ trước', `${rut.length} thẻ`)
      return { ok: true, data: ds, ky: layKyHienTai(), canhBaoLamMoi: lm.loi }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('bang-luong:chon-file-mau', async () => {
    try {
      let duongDan = duongDanTest('TSC_TEST_FILE_MAU')
      if (!duongDan) {
        const w = win()
        const r = await dialog.showOpenDialog(w!, {
          title: 'Chọn file mẫu bảng lương (thường là kỳ trước)',
          filters: [{ name: 'Excel', extensions: ['xlsx'] }],
          properties: ['openFile']
        })
        if (r.canceled || !r.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn file.' }
        duongDan = r.filePaths[0]
      }
      ghiConfig({ fileMauBangLuongGanNhat: duongDan })
      return { ok: true, data: { duongDan } }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('ky-cong:tinh-lai-ngay', (_e, p: { maNhanVien: string; ngay: string; cap: { vao: string | null; ra: string | null }[] }) => {
    if (!kyHienTai) return { ok: false, loi: 'Chưa nạp kỳ công.' }
    const th = kyHienTai.ky.tongHop.find((t) => t.maNhanVien === p.maNhanVien)
    if (!th) return { ok: false, loi: 'Không tìm thấy nhân viên trong kỳ.' }
    const idx = th.ketQuaNgay.findIndex((d) => d.ngay === p.ngay)
    if (idx < 0) return { ok: false, loi: 'Không tìm thấy ngày.' }
    // Validate định dạng giờ ở tầng main — ô rỗng thì cho qua, gõ sai thì chặn
    //.
    for (const c of p.cap) {
      for (const g of [c.vao, c.ra]) {
        if (g != null && g !== '' && phutTrongNgay(g) == null)
          return { ok: false, loi: `Giờ "${g}" không đúng dạng. Nhập dạng HH:MM, ví dụ 08:30. Để trống nếu không có.` }
      }
    }
    const dongMoi = tinhLaiMotDong(th.ketQuaNgay[idx], p.cap, th.nguongGioChuanNgay)
    th.ketQuaNgay[idx] = dongMoi
    const thMoi = tinhLaiTongHop(th, th.ketQuaNgay)
    Object.assign(th, thMoi)
    capNhatTongKy()
    return { ok: true, data: { dong: dongMoi, tongHop: th } }
  })

  ipcMain.handle('ky-cong:xuat', async (_e, p: { ghiDe: boolean }) => {
    try {
      if (!kyHienTai) return { ok: false, loi: 'Chưa nạp kỳ công.' }
      if (kyHienTai.ky.thieuSetup.length > 0) {
        log.event('xuat-that-bai', { ly_do: 'thieu-setup', so: kyHienTai.ky.thieuSetup.length })
        return { ok: false, loi: 'Còn nhân viên chưa khai Setup — khai đủ trước khi xuất.' }
      }

      const c = layConfig()
      if (!c.fileMauBangLuongGanNhat || !existsSync(c.fileMauBangLuongGanNhat))
        return { ok: false, loi: 'Chưa chọn file mẫu bảng lương. Bấm "Chọn file mẫu" trước.' }

      let thuMuc = duongDanTest('TSC_TEST_THU_MUC_XUAT')
      if (!thuMuc) {
        const w = win()
        const rDir = await dialog.showOpenDialog(w!, {
          title: 'Chọn thư mục lưu 2 file kết quả',
          defaultPath: c.thuMucXuatGanNhat || dirname(kyHienTai.fileMay),
          properties: ['openDirectory', 'createDirectory']
        })
        if (rDir.canceled || !rDir.filePaths[0]) return { ok: false, loi: 'Đã huỷ chọn thư mục.' }
        thuMuc = rDir.filePaths[0]
      }

      const ten = tenFileXuat(kyHienTai.ky.thang)
      const pBL = join(thuMuc, ten.bangLuong)
      const pCT = join(thuMuc, ten.chiTiet)

      if (!p.ghiDe) {
        const trung = [pBL, pCT].filter((x) => existsSync(x)).map((x) => basename(x))
        if (trung.length) return { ok: false, canXacNhanGhiDe: trung }
      }

      const bl = await ghiBangLuong(c.fileMauBangLuongGanNhat, pBL, kyHienTai.ky.tongHop, {
        ngayBatDau: kyHienTai.ky.ngayBatDau,
        ngayKetThuc: kyHienTai.ky.ngayKetThuc
      })
      let ct: { duongDanRa: string; soDongToVang: number }
      try {
        ct = await ghiChiTietDaLamSach(kyHienTai.fileMay, pCT, kyHienTai.ky.tongHop)
      } catch (e) {
        // Bảng lương đã ghi xong, file chi tiết lỗi → nói rõ trạng thái từng file (BH-12).
        const r = loi(e)
        return { ...r, loi: `Đã ghi xong "${ten.bangLuong}". Nhưng "${ten.chiTiet}": ${r.loi} Bấm Xuất lại để ghi nốt file chi tiết.` }
      }
      ghiConfig({ thuMucXuatGanNhat: thuMuc })
      log.info('xuất', thuMuc, `${bl.daGhi.length} thẻ lương, ${ct.soDongToVang} dòng vàng`)
      log.event('xuat-hoan-tat', {
        thang: kyHienTai.ky.thang,
        theLuong: bl.daGhi.length,
        theKhongKhop: bl.khongKhop.length,
        theGiuSoCu: bl.theGiuSoCu.length,
        dongToVang: ct.soDongToVang
      })

      return {
        ok: true,
        data: {
          bangLuong: {
            duongDan: pBL,
            daGhi: bl.daGhi.length,
            khongKhop: bl.khongKhop,
            theGiuSoCu: bl.theGiuSoCu
          },
          chiTiet: { duongDan: pCT, soDongToVang: ct.soDongToVang },
          thuMuc
        }
      }
    } catch (e) {
      return loi(e)
    }
  })

  ipcMain.handle('mo-thu-muc', (_e, duongDan: string) => {
    // Chỉ mở thư mục công cụ vừa ghi vào (renderer không mở đường dẫn tuỳ ý — REV).
    const choPhep = layConfig().thuMucXuatGanNhat
    if (!duongDan || duongDan !== choPhep || !existsSync(duongDan)) return
    shell.openPath(duongDan)
  })

  // Mốc "đã xem kết quả kỳ trong app" — success metric vòng 2 (đọc trong app thay vì
  // mở Excel). Pha E đếm kỳ có `xem-cong-s7` mà KHÔNG có `xuat-hoan-tat` = đọc trong app.
  ipcMain.handle('ky-cong:danh-dau-xem-cong', () => {
    if (!kyHienTai) return
    log.event('xem-cong-s7', {
      thang: kyHienTai.ky.thang,
      soNhanVien: kyHienTai.ky.tongHop.length,
      tongThanhTien: kyHienTai.ky.tongThanhTienCaKy
    })
  })

  // Kênh phản hồi trong sản phẩm. Địa chỉ cố định ở main —
  // renderer không truyền URL vào (tránh mở link tuỳ ý).
  ipcMain.handle('mo-gop-y', () => {
    const tieuDe = encodeURIComponent('Góp ý / báo lỗi — Timesheet Calculator')
    shell.openExternal(`mailto:feedback@example.com?subject=${tieuDe}`)
  })
}

/**
 * Sau khi Setup đổi → tính lại kỳ đang mở (nếu có) để AC-6 phản ánh ngay.
 * Đọc lại file máy thất bại (file bị di chuyển/khoá) → KHÔNG nuốt lỗi: trả cảnh báo
 * để renderer báo người dùng nạp lại, thay vì hành động trên kỳ cũ.
 */
async function lamMoiKyHienTai(): Promise<{ loi?: string }> {
  if (!kyHienTai) return {}
  try {
    const file = await docFileMay(kyHienTai.fileMay)
    kyHienTai = { fileMay: kyHienTai.fileMay, ky: xuLyKyCong(file, layNhanVien()) }
    return {}
  } catch (e) {
    log.error('làm mới kỳ', (e as Error).message)
    return {
      loi: 'Đã lưu Setup, nhưng không đọc lại được file máy chấm công (có thể đã bị di chuyển hoặc đang mở ở Excel). Nạp lại file máy để cập nhật bảng tổng hợp.'
    }
  }
}

function capNhatTongKy() {
  if (!kyHienTai) return
  Object.assign(kyHienTai.ky, tongToanKy(kyHienTai.ky.tongHop))
}

/** Cho renderer lấy lại kỳ hiện tại sau khi Setup thay đổi. */
export function layKyHienTai(): KetQuaKyCong | null {
  return kyHienTai?.ky ?? null
}
