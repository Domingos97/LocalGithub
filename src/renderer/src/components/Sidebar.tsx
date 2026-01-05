import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderGit2, Settings, Github, Moon, Sun } from 'lucide-react';
import '../styles/Sidebar.css';

interface SidebarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

function Sidebar({ darkMode, onToggleDarkMode }: SidebarProps) {

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/projects', icon: FolderGit2, label: 'Projects' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Github size={28} />
          <span className="sidebar-title">LocalGitHub</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={onToggleDarkMode}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
