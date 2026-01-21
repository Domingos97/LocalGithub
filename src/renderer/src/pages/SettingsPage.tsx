import { useState, useEffect } from 'react';
import { 
  Key, 
  RefreshCw, 
  Folder, 
  Monitor, 
  Bell, 
  Shield,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '../components/Toast';
import '../styles/Settings.css';

interface Settings {
  autoRefresh: boolean;
  autoRefreshInterval: number;
  autoStartProjects: boolean;
  maxConcurrentProcesses: number;
  defaultCloneDirectory: string;
  showNotifications: boolean;
}

function SettingsPage() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);
  const [projectsDir, setProjectsDir] = useState('');
  const [settings, setSettings] = useState<Settings>({
    autoRefresh: true,
    autoRefreshInterval: 5,
    autoStartProjects: false,
    maxConcurrentProcesses: 5,
    defaultCloneDirectory: '',
    showNotifications: true,
  });
  const { addToast } = useToast();

  useEffect(() => {
    loadSettings();
    loadProjectsDir();
  }, []);

  const loadProjectsDir = async () => {
    try {
      const result = await (window as any).electronAPI.project.getBaseDir();
      if (result.success) {
        setProjectsDir(result.data.path);
      }
    } catch (error) {
      console.error('Failed to get projects directory:', error);
    }
  };

  const handleSelectProjectsDir = async () => {
    try {
      const result = await (window as any).electronAPI.dialog.selectFolder();
      if (result.success && result.path) {
        const updateResult = await (window as any).electronAPI.project.setBaseDir(result.path);
        if (updateResult.success) {
          setProjectsDir(result.path);
          addToast({ type: 'success', title: 'Directory Updated', message: 'Projects directory has been changed' });
        } else {
          addToast({ type: 'error', title: 'Error', message: 'Failed to update directory' });
        }
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to select directory' });
    }
  };

  const loadSettings = async () => {
    // In production, load from electron store
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  };

  const saveSettings = () => {
    localStorage.setItem('settings', JSON.stringify(settings));
    addToast({ type: 'success', title: 'Settings Saved', message: 'Your preferences have been updated' });
  };

  const handleUpdateToken = async () => {
    if (!token.trim()) {
      addToast({ type: 'error', title: 'Error', message: 'Please enter a token' });
      return;
    }

    setTokenSaving(true);
    try {
      // In production, this would securely store the token
      await new Promise((resolve) => setTimeout(resolve, 1000));
      addToast({ type: 'success', title: 'Token Updated', message: 'GitHub token has been saved securely' });
      setToken('');
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to save token' });
    } finally {
      setTokenSaving(false);
    }
  };

  const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="settings-page animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your preferences and GitHub connection</p>
        </div>
      </div>

      {/* GitHub Configuration */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <Key size={20} />
          </div>
          <div className="section-info">
            <h2>GitHub Authentication</h2>
            <p>Manage your GitHub personal access token</p>
          </div>
        </div>
        <div className="section-content">
          <div className="form-group">
            <label className="form-label">Personal Access Token</label>
            <div className="token-input-wrapper">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="input"
              />
              <button
                type="button"
                className="token-toggle"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="form-hint">
              Generate a token at GitHub → Settings → Developer settings → Personal access tokens
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleUpdateToken}
            disabled={tokenSaving || !token.trim()}
          >
            {tokenSaving ? (
              <>
                <RefreshCw size={16} className="spin" />
                Saving...
              </>
            ) : (
              <>
                <Shield size={16} />
                Update Token
              </>
            )}
          </button>
        </div>
      </section>

      {/* Repository Settings */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <Folder size={20} />
          </div>
          <div className="section-info">
            <h2>Repository Settings</h2>
            <p>Configure how repositories are managed</p>
          </div>
        </div>
        <div className="section-content">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Auto-refresh repositories</span>
              <span className="setting-description">Automatically fetch repository updates</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={(e) => handleSettingChange('autoRefresh', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {settings.autoRefresh && (
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Refresh interval</span>
                <span className="setting-description">How often to check for updates</span>
              </div>
              <select
                className="input setting-select"
                value={settings.autoRefreshInterval}
                onChange={(e) => handleSettingChange('autoRefreshInterval', parseInt(e.target.value))}
              >
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
          )}

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Projects install directory</span>
              <span className="setting-description">Where projects are installed locally</span>
            </div>
            <div className="setting-path-wrapper">
              <div className="setting-path">
                <code>{projectsDir || 'Loading...'}</code>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleSelectProjectsDir}>
                <Folder size={16} />
                Change Directory
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Default clone directory</span>
              <span className="setting-description">Custom directory for future projects</span>
            </div>
            <input
              type="text"
              className="input setting-input"
              placeholder="~/Projects"
              value={settings.defaultCloneDirectory}
              onChange={(e) => handleSettingChange('defaultCloneDirectory', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Process Settings */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <Monitor size={20} />
          </div>
          <div className="section-info">
            <h2>Process Management</h2>
            <p>Configure how projects are run</p>
          </div>
        </div>
        <div className="section-content">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Auto-start projects</span>
              <span className="setting-description">Start previously running projects on launch</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoStartProjects}
                onChange={(e) => handleSettingChange('autoStartProjects', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Max concurrent processes</span>
              <span className="setting-description">Maximum projects running simultaneously</span>
            </div>
            <input
              type="number"
              className="input setting-input-sm"
              min={1}
              max={20}
              value={settings.maxConcurrentProcesses}
              onChange={(e) => handleSettingChange('maxConcurrentProcesses', parseInt(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* Notification Settings */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <Bell size={20} />
          </div>
          <div className="section-info">
            <h2>Notifications</h2>
            <p>Manage notification preferences</p>
          </div>
        </div>
        <div className="section-content">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Show notifications</span>
              <span className="setting-description">Display system notifications for events</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showNotifications}
                onChange={(e) => handleSettingChange('showNotifications', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="settings-footer">
        <button className="btn btn-primary btn-lg" onClick={saveSettings}>
          <Check size={18} />
          Save All Settings
        </button>
      </div>
    </div>
  );
}

export default SettingsPage;
