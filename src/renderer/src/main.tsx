import React from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import { App } from './App'
import { apDungHienThi } from './hienThi'

async function khoiDong(): Promise<void> {
  // Đọc + áp thiết lập Hiển thị TRƯỚC khi vẽ màn đầu.
  const hienThi = await window.api.layHienThi()
  apDungHienThi(hienThi)

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App hienThiBanDau={hienThi} />
    </React.StrictMode>
  )
}

khoiDong()
