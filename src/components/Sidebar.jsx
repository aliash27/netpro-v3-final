import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  { path: '/',            icon: '🏠', label: 'الرئيسية' },
  { path: '/subscribers', icon: '👥', label: 'المشتركون' },
  { path: '/debts',       icon: '⚠️', label: 'الديون المستحقة' },
  { path: '/payments',    icon: '📋', label: 'سجل الدفعات' },
  { path: '/reports',     icon: '📊', label: 'التقارير' },
  { path: '/sheets',      icon: '🔗', label: 'ربط Google Sheets' },
  { path: '/settings',    icon: '⚙️', label: 'الإعدادات' },
  { path: '/accountants', icon: '👤', label: 'المحاسبون الفرعيون' },
  { path: '/pricing',     icon: '💎', label: 'الباقات والاشتراك' },
]

const planNames = {
  trial: '⭐ تجريبي',
  starter: '⚡ البداية',
  pro: '💎 الاحترافي',
  business: '🏢 الأعمال'
}

export default function Sidebar({ open, onClose, gsConnected }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, company, signOut, trialDaysLeft } = useAuth()

  const trialPct = Math.min(100, (trialDaysLeft / 7) * 100)

  async function handleLogout() {
    await signOut()
    onClose()
    navigate('/login')
  }

  function go(path) {
    navigate(path)
    onClose()
  }

  return (
    <>
      <div
        className={`sidebar-veil ${open ? 'open' : ''}`}
        onClick={onClose}
      />
      <div className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-chip">
            <div className="sidebar-online" />
            <span>{user?.email?.split('@')[0] || '—'}</span>
          </div>
          <div className="sidebar-name">{company?.name || '—'}</div>
          <div className="sidebar-company">{user?.email || '—'}</div>
          <div className="sidebar-badge">
            {planNames[company?.plan] || '⭐ تجريبي'}
          </div>
          {company?.plan === 'trial' && (
            <div className="trial-bar">
              <div className="trial-bar-label">
                الفترة التجريبية: <strong>{trialDaysLeft}</strong> أيام متبقية
              </div>
              <div className="trial-progress">
                <div className="trial-fill" style={{ width: `${trialPct}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-links">
          {links.map(link => (
            <button
              key={link.path}
              className={`sidebar-link ${location.pathname === link.path ? 'active' : ''}`}
              onClick={() => go(link.path)}
            >
              <span className="link-icon">{link.icon}</span>
              {link.label}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="gs-status">
            <div className={`gs-dot ${gsConnected ? 'connected' : 'disconnected'}`} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                Google Sheets
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                {gsConnected ? 'متصل ✅' : 'غير متصل'}
              </div>
            </div>
          </div>
          <button
            className="sidebar-link"
            style={{ color: 'var(--rose)' }}
            onClick={handleLogout}
          >
            <span className="link-icon">🚪</span>
            تسجيل الخروج
          </button>
        </div>
      </div>
    </>
  )
}
