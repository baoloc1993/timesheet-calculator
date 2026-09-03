import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { moStore, layHienThi } from './settings/store'
import { dangKyIpc } from './ipc'
import { log } from './logger'

/** Màu nền cửa sổ trước khi renderer kịp vẽ (tránh chớp trắng/đen) — đoán theo thiết lập
 * Hiển thị đã lưu (vòng 4); "Theo Windows" thì đoán theo `nativeTheme` của OS. */
function mauNenCuaSo(): string {
  const h = layHienThi()
  const toi = h.theme === 'dark' || (h.theme === 'auto' && nativeTheme.shouldUseDarkColors)
  return toi ? '#0F141B' : '#EDF0F5'
}

function taoCuaSo(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Timesheet Calculator',
    backgroundColor: mauNenCuaSo(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler((d) => {
    shell.openExternal(d.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    moStore()
  } catch (e) {
    log.error('mở store', (e as Error).message)
  }
  dangKyIpc()
  taoCuaSo()
  log.info('app khởi động', app.getVersion())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) taoCuaSo()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (e) => log.error('uncaught', e.message, e.stack || ''))
