import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { ToastProvider } from './components/Toast';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import SettingsPage from './pages/SettingsPage';
import Spinner from './components/Spinner';
import { AlertCircle, KeyRound } from 'lucide-react';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    validateToken();
  }, []);

  const validateToken = async () => {
    try {
      const result = await (window as any).electronAPI.github.validateToken();
      setTokenValid(result.success);
      if (!result.success) {
        console.error('GitHub token is invalid. Please set GITHUB_TOKEN environment variable.');
      }
    } catch (error) {
      console.error('Token validation error:', error);
      setTokenValid(false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  if (isLoading) {
    return (
      <div className="fullpage-container">
        <div className="loading-screen">
          <Spinner size="lg" />
          <h2>Loading LocalGitHub...</h2>
          <p>Connecting to GitHub</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="fullpage-container">
        <div className="error-screen">
          <div className="error-icon">
            <AlertCircle size={64} />
          </div>
          <h1>Authentication Required</h1>
          <p className="error-description">
            GitHub token is not configured or invalid.
          </p>
          <div className="error-steps">
            <div className="step">
              <KeyRound size={20} />
              <span>Set the <code>GITHUB_TOKEN</code> environment variable</span>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <div className="app-layout">
          <Sidebar darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
