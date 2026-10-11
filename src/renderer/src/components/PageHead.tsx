import type { ReactNode } from 'react'

// Đầu trang chung cho mọi màn: breadcrumb + tiêu đề + nút hành động chính
// dính bên phải, dính đầu khi cuộn. Giữ nguyên cấu trúc <h1>{title}<span class="sub"> — e2e
// tìm màn bằng `h1:has-text(...)`, không được đổi text bên trong h1.
export function PageHead({
  crumb,
  title,
  sub,
  actions
}: {
  crumb?: ReactNode
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>
          {title}
          {sub && <span className="sub">{sub}</span>}
        </h1>
      </div>
      {actions && <div className="acts">{actions}</div>}
    </div>
  )
}
