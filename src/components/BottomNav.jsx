import { useLocation, useNavigate } from 'react-router-dom'

const items = [
  { path: '/',            icon: '🏠', label: 'الرئيسية' },
  { path: '/subscribers', icon: '👥', label: 'المشتركون' },
  { path: '/debts',       icon: '⚠️', label: 'الديون' },
  { path: '/payments',    icon: '📋', label: 'السجل' },
  { path: '/settings',    icon: '⚙️', label: 'الإعدادات' },
]

export default function BottomNav({ debtCount = 0 }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav">
      {items.map(item => {
        const active = location.pathname === item.path
        return (
          <button
            key={item.path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <div className="nav-icon">{item.icon}</div>
            <span>{item.label}</span>
            {item.path === '/debts' && debtCount > 0 && (
              <div className="nav-pip" style={{
                background: 'var(--rose)', opacity: 1
              }} />
            )}
            {active && item.path !== '/debts' && (
              <div className="nav-pip" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
