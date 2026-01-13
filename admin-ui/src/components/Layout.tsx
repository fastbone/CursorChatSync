import { Outlet, Link, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  onLogout: () => void;
}

export default function Layout({ onLogout }: LayoutProps) {
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  const navItems = [
    { path: '/users', label: 'Users' },
    { path: '/projects', label: 'Projects' },
    { path: '/permissions', label: 'Permissions' },
    { path: '/teams', label: 'Teams' },
    { path: '/chat-history', label: 'Chat History' },
  ];

  return (
    <div className="layout">
      <nav className="sidebar">
        <h2>Cursor Chat Sync</h2>
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <button onClick={handleLogout} className="btn btn-secondary logout-btn">
          Logout
        </button>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
