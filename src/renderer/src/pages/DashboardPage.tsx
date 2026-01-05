import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderGit2, 
  Download, 
  Play, 
  ArrowRight, 
  RefreshCw,
  Activity,
  GitBranch,
  Star
} from 'lucide-react';
import ProcessMonitor from '../components/ProcessMonitor';
import Spinner from '../components/Spinner';
import '../styles/Dashboard.css';

interface User {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

interface RunningProcess {
  id: string;
  name: string;
  port?: number;
  status: 'running' | 'stopped' | 'error';
  startTime?: Date;
}

function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    totalRepos: 0,
    installedProjects: 0,
    runningProcesses: 0,
  });
  const [processes, setProcesses] = useState<RunningProcess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Fetch user data
      const userResult = await (window as any).electronAPI.github.getCurrentUser();
      if (userResult.success) {
        setUser(userResult.data);
        setStats((prev) => ({ ...prev, totalRepos: userResult.data.public_repos }));
      }

      // Fetch running processes
      const processResult = await (window as any).electronAPI.process.getAll();
      if (processResult.success) {
        setProcesses(processResult.data);
        setStats((prev) => ({ ...prev, runningProcesses: processResult.data.length }));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopProcess = async (id: string) => {
    try {
      await (window as any).electronAPI.process.stop(id);
      loadDashboardData();
    } catch (error) {
      console.error('Error stopping process:', error);
    }
  };

  const handleOpenBrowser = (port: number) => {
    window.open(`http://localhost:${port}`, '_blank');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Spinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="dashboard animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadDashboardData}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* User Profile Card */}
      {user && (
        <div className="profile-card">
          <img src={user.avatar_url} alt={user.login} className="profile-avatar" />
          <div className="profile-info">
            <h2 className="profile-name">{user.name || user.login}</h2>
            <span className="profile-username">@{user.login}</span>
          </div>
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-value">{user.public_repos}</span>
              <span className="profile-stat-label">Repos</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{user.followers}</span>
              <span className="profile-stat-label">Followers</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{user.following}</span>
              <span className="profile-stat-label">Following</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <FolderGit2 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalRepos}</span>
            <span className="stat-label">Total Repositories</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <Download size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.installedProjects}</span>
            <span className="stat-label">Installed Projects</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">
            <Play size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.runningProcesses}</span>
            <span className="stat-label">Running Processes</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Running Processes */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <Activity size={20} />
              <span>Running Processes</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <ProcessMonitor 
              processes={processes}
              onStop={handleStopProcess}
              onOpen={handleOpenBrowser}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <Star size={20} />
              <span>Quick Actions</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <div className="quick-actions">
              <Link to="/projects" className="quick-action-item">
                <div className="quick-action-icon">
                  <FolderGit2 size={20} />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-title">Browse Projects</span>
                  <span className="quick-action-desc">View and manage all your repositories</span>
                </div>
                <ArrowRight size={16} className="quick-action-arrow" />
              </Link>

              <Link to="/settings" className="quick-action-item">
                <div className="quick-action-icon">
                  <GitBranch size={20} />
                </div>
                <div className="quick-action-content">
                  <span className="quick-action-title">Settings</span>
                  <span className="quick-action-desc">Configure app and GitHub settings</span>
                </div>
                <ArrowRight size={16} className="quick-action-arrow" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
