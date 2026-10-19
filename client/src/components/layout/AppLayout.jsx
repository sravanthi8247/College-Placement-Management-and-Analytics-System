import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../pages/Dashboard.css';

function AppLayout({ title, eyebrow = 'Workspace', children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  // Close dropdown on navigation to another page
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const adminLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/students', label: 'Students', icon: '♙' },
    { to: '/students/import', label: 'Bulk Import', icon: '📥' },
    { to: '/companies', label: 'Companies', icon: '▤' },
    { to: '/placements', label: 'Placements', icon: '▣' },
    { to: '/applications', label: 'Applications', icon: '✉' },
    { to: '/reports', label: 'Reports', icon: '📊' },
  ];

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/profile', label: 'My Profile', icon: '♙' },
    { to: '/drives', label: 'Placement Drives', icon: '▤' },
    { to: '/applications', label: 'My Applications', icon: '✉' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;
  const userRoleDisplay = user?.role === 'admin' ? 'Admin' : 'Student';

  return (
    <div className="cpma-dashboard">
      <aside className="cpma-sidebar">
        <Link to="/dashboard" className="cpma-brand">
          <span className="cpma-brand-icon">PP</span>
          <span className="cpma-brand-text">
            <strong>Placement Portal</strong>
            <small>College placements</small>
          </span>
        </Link>

        <div className="cpma-nav-label">WORKSPACE</div>

        <nav className="cpma-side-nav" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `cpma-nav-link${isActive ? ' active' : ''}`
              }
            >
              <span className="cpma-nav-icon">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="cpma-sidebar-bottom">
          <div className="cpma-sidebar-note">
            <span className="cpma-note-icon">i</span>
            <div>
              <strong>Placement Portal</strong>
              <p>Track drives, eligibility, and placement outcomes.</p>
            </div>
          </div>

          <button type="button" className="cpma-logout" onClick={handleLogout}>
            <span>↪</span> Log out
          </button>
        </div>
      </aside>

      <div className="cpma-main">
        <header className="cpma-topbar">
          <div>
            <div className="cpma-breadcrumb">{eyebrow}</div>
            <h1>{title}</h1>
          </div>

          <div className="cpma-user-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className={`cpma-user-btn ${dropdownOpen ? 'active' : ''}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              aria-label="User profile menu"
            >
              <div className="cpma-avatar">
                {(user?.name || 'U').trim().charAt(0).toUpperCase()}
              </div>
              <div className="cpma-user-details">
                <strong>{user?.name || 'User'}</strong>
                <span>{userRoleDisplay}</span>
              </div>
              <span className={`cpma-chevron ${dropdownOpen ? 'open' : ''}`} aria-hidden="true">▾</span>
            </button>

            {dropdownOpen && (
              <div className="cpma-dropdown-menu" role="menu">
                <div className="cpma-dropdown-header">
                  <div className="cpma-dropdown-avatar">
                    {(user?.name || 'U').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="cpma-dropdown-info">
                    <strong className="cpma-dropdown-name">{user?.name || 'User'}</strong>
                    <span className="cpma-dropdown-role">{userRoleDisplay}</span>
                    {user?.email && <small className="cpma-dropdown-email">{user.email}</small>}
                  </div>
                </div>

                <div className="cpma-dropdown-divider" />

                <div className="cpma-dropdown-items">
                  {user?.role === 'student' && (
                    <Link
                      to="/profile"
                      className="cpma-dropdown-item"
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="cpma-dropdown-icon">👤</span> My Profile
                    </Link>
                  )}
                  {user?.role === 'admin' && (
                    <Link
                      to="/dashboard"
                      className="cpma-dropdown-item"
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="cpma-dropdown-icon">▦</span> Dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    className="cpma-dropdown-item cpma-dropdown-logout"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <span className="cpma-dropdown-icon">↪</span> Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="cpma-content">{children}</div>
      </div>
    </div>
  );
}

export default AppLayout;
