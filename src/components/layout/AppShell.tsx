import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface AppShellProps {
  children: ReactNode
}

/** 세 핵심 화면이 공유하는 레이아웃(헌장 원칙 XII: 정보 구조·디자인 일관성) */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__nav">
        <span className="app-shell__brand">QUANT-MIND</span>
        <nav>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            대시보드
          </NavLink>
          <NavLink to="/holdings" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            계좌·종목
          </NavLink>
          <NavLink to="/judgment-log" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            판단 로그
          </NavLink>
        </nav>
      </header>
      <main className="app-shell__content">{children}</main>
    </div>
  )
}
