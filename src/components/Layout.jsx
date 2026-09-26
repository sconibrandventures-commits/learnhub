import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { Icon, Avatar } from './ui'
import { isDemo } from '../lib/backend'
import { config } from '../config'

const NAV = {
  student: [
    { to: '/student', label: 'My courses', icon: 'home', end: true },
    { to: '/student/catalog', label: 'Course catalogue', icon: 'search' },
  ],
  instructor: [
    { to: '/instructor', label: 'Dashboard', icon: 'home', end: true },
    { to: '/instructor/courses', label: 'My courses', icon: 'book' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
    { to: '/admin/users', label: 'Users', icon: 'users' },
    { to: '/admin/courses', label: 'Courses', icon: 'book' },
    { to: '/admin/enrolments', label: 'Enrolments', icon: 'key' },
  ],
}

export default function Layout({ children, courseNav = null, title }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nav = NAV[user?.role] || []

  async function doLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <>
      {isDemo && (
        <div className="demo-ribbon">
          Demo mode — sample data stored in this browser only. Nothing is saved to a server.
        </div>
      )}

      <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">L</div>
          <div className="txt">
            <div className="sidebar__name">{config.appName}</div>
            <div className="sidebar__sub">Training portal</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          {courseNav ? (
            <>
              <div className="sidebar__label">This course</div>
              {courseNav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  <Icon name={item.icon} className="ico" /> {item.label}
                </NavLink>
              ))}
              <div className="sidebar__label">Portal</div>
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  <Icon name={item.icon} className="ico" /> {item.label}
                </NavLink>
              ))}
            </>
          ) : (
            <>
              <div className="sidebar__label">Menu</div>
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  <Icon name={item.icon} className="ico" /> {item.label}
                </NavLink>
              ))}
            </>
          )}

          <div className="sidebar__label">Account</div>
          <NavLink to="/profile">
            <Icon name="cog" className="ico" /> My profile
          </NavLink>
        </nav>

        <div className="sidebar__foot">
          <Avatar name={user?.name} />
          <div className="who">
            <b>{user?.name}</b>
            <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={doLogout} title="Sign out" style={{ color: '#94a3b8' }}>
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__title">{title || config.appName}</div>
          <div className="topbar__spacer" />
          {!isDemo && (
            <span className="badge badge--ok" title="Connected to Appwrite">
              <span className="dot" /> Live
            </span>
          )}
        </header>
        <main className="content">{children}</main>
      </div>
      </div>
    </>
  )
}
