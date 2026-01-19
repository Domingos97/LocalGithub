import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Play,
  Square,
  ExternalLink,
  GitBranch,
  Star,
  GitFork,
  Clock,
  Code,
  Folder,
  Globe,
  Lock,
  RefreshCw,
  FileCode,
  Trash2,
} from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import TerminalOutput from '../components/TerminalOutput';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import '../styles/ProjectDetails.css';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  size: number;
  open_issues_count: number;
}

interface ProjectState {
  isInstalled: boolean;
  isRunning: boolean;
  localPath?: string;
  port?: number;
}

function ProjectDetailsPage() {
  const { repoName } = useParams<{ repoName: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [repo, setRepo] = useState<Repository | null>(null);
  const [projectState, setProjectState] = useState<ProjectState>({
    isInstalled: false,
    isRunning: false,
  });
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  useEffect(() => {
    loadRepoDetails();
  }, [repoName]);

  useEffect(() => {
    checkInstallStatus();
  }, [repoName]);

  const checkInstallStatus = async () => {
    if (!repoName) return;
    try {
      const result = await (window as any).electronAPI.project.isInstalled(repoName);
      if (result.success && result.data.installed) {
        const pathResult = await (window as any).electronAPI.git.getProjectPath(repoName);
        if (pathResult.success) {
          setProjectState(prev => ({
            ...prev,
            isInstalled: true,
            localPath: pathResult.data.projectPath,
          }));
        }
      }
    } catch (error) {
      console.error('Error checking install status:', error);
    }
  };

  const loadRepoDetails = async () => {
    try {
      setLoading(true);
      const result = await (window as any).electronAPI.github.getRepository(repoName);
      if (result.success) {
        setRepo(result.data);
      } else {
        addToast({ type: 'error', title: 'Failed to load repository', message: result.error });
      }
    } catch (error) {
      console.error('Error loading repository:', error);
      addToast({ type: 'error', title: 'Error', message: 'Failed to load repository details' });
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!repo) return;

    setInstalling(true);
    setInstallProgress(0);
    setTerminalLines(['$ Starting installation...']);

    try {
      // Subscribe to clone progress
      const unsubscribeClone = (window as any).electronAPI.git.onCloneProgress((data: any) => {
        setTerminalLines((prev) => [...prev, data.message]);
        setInstallProgress(data.progress || 0);
      });

      setTerminalLines((prev) => [...prev, `$ git clone ${repo.clone_url}`]);
      setInstallProgress(10);

      const cloneResult = await (window as any).electronAPI.git.clone(repo.clone_url, repo.name);
      
      if (cloneResult.success) {
        setTerminalLines((prev) => [...prev, '✓ Repository cloned successfully']);
        setInstallProgress(50);

        setTerminalLines((prev) => [...prev, '$ npm install']);
        setInstallProgress(60);

        const installResult = await (window as any).electronAPI.installer.install(cloneResult.data.path);
        
        if (installResult.success) {
          setTerminalLines((prev) => [...prev, '✓ Dependencies installed successfully']);
          setInstallProgress(100);
          setProjectState({ ...projectState, isInstalled: true, localPath: cloneResult.data.path });
          addToast({ type: 'success', title: 'Installation Complete', message: `${repo.name} installed successfully` });
        } else {
          setTerminalLines((prev) => [...prev, `Error: ${installResult.error}`]);
          addToast({ type: 'error', title: 'Installation Failed', message: installResult.error });
        }
      } else {
        setTerminalLines((prev) => [...prev, `Error: ${cloneResult.error}`]);
        addToast({ type: 'error', title: 'Clone Failed', message: cloneResult.error });
      }

      unsubscribeClone();
    } catch (error) {
      console.error('Installation error:', error);
      setTerminalLines((prev) => [...prev, `Error: ${error}`]);
      addToast({ type: 'error', title: 'Error', message: 'Installation failed' });
    } finally {
      setInstalling(false);
    }
  };

  const handleRun = async () => {
    if (!repo || !projectState.localPath) return;

    setRunning(true);
    setTerminalLines((prev) => [...prev, '', '$ npm start']);

    try {
      // Subscribe to process output - stored for cleanup on component unmount
      (window as any).electronAPI.process.onOutput((data: any) => {
        setTerminalLines((prev) => [...prev, data.output]);
        
        // Detect port from output
        const portMatch = data.output.match(/localhost:(\d+)/);
        if (portMatch) {
          setProjectState((prev) => ({ ...prev, port: parseInt(portMatch[1]) }));
        }
      });

      const result = await (window as any).electronAPI.process.start(projectState.localPath, repo.name);
      
      if (result.success) {
        setProjectState((prev) => ({ ...prev, isRunning: true }));
        addToast({ type: 'success', title: 'Project Started', message: `${repo.name} is now running` });
      } else {
        setTerminalLines((prev) => [...prev, `Error: ${result.error}`]);
        addToast({ type: 'error', title: 'Failed to Start', message: result.error });
        setRunning(false);
      }

      // Note: We don't unsubscribe here as we want to keep receiving output
    } catch (error) {
      console.error('Run error:', error);
      setTerminalLines((prev) => [...prev, `Error: ${error}`]);
      addToast({ type: 'error', title: 'Error', message: 'Failed to start project' });
      setRunning(false);
    }
  };

  const handleStop = async () => {
    if (!repo) return;

    try {
      const result = await (window as any).electronAPI.process.stop(repo.name);
      
      if (result.success) {
        setProjectState((prev) => ({ ...prev, isRunning: false }));
        setRunning(false);
        setTerminalLines((prev) => [...prev, '', '$ Process stopped']);
        addToast({ type: 'info', title: 'Process Stopped', message: `${repo.name} has been stopped` });
      }
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  const handleOpenInBrowser = () => {
    if (projectState.port) {
      window.open(`http://localhost:${projectState.port}`, '_blank');
    }
  };

  const handleOpenGitHub = () => {
    if (repo?.html_url) {
      window.open(repo.html_url, '_blank');
    }
  };

  const handleOpenInVSCode = async () => {
    if (!projectState.localPath) return;
    try {
      const result = await (window as any).electronAPI.project.openInVSCode(projectState.localPath);
      if (result.success) {
        addToast({ type: 'success', title: 'Opening VS Code', message: `Opening ${repo?.name} in Visual Studio Code` });
      } else {
        addToast({ type: 'error', title: 'Failed to open VS Code', message: result.error });
      }
    } catch (error) {
      console.error('Error opening in VS Code:', error);
      addToast({ type: 'error', title: 'Error', message: 'Failed to open in Visual Studio Code' });
    }
  };

  const handleUninstall = async () => {
    if (!repo) return;
    try {
      const result = await (window as any).electronAPI.project.uninstall(repo.name);
      if (result.success) {
        setProjectState({ isInstalled: false, isRunning: false });
        addToast({ type: 'success', title: 'Uninstalled', message: `${repo.name} has been removed` });
      } else {
        addToast({ type: 'error', title: 'Uninstall Failed', message: result.error });
      }
    } catch (error) {
      console.error('Error uninstalling:', error);
      addToast({ type: 'error', title: 'Error', message: 'Failed to uninstall project' });
    }
  };

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="project-details-loading">
        <Spinner size="lg" text="Loading project details..." />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="project-details-error">
        <h2>Project not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/projects')}>
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="project-details animate-fadeIn">
      {/* Header */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate('/projects')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-info">
          <div className="header-title-row">
            <h1>{repo.name}</h1>
            <span className={`visibility-badge ${repo.private ? 'private' : 'public'}`}>
              {repo.private ? <Lock size={12} /> : <Globe size={12} />}
              {repo.private ? 'Private' : 'Public'}
            </span>
          </div>
          <p className="header-description">{repo.description || 'No description'}</p>
        </div>
        <div className="header-actions">
          {projectState.isInstalled && projectState.localPath && (
            <button className="btn btn-vscode" onClick={handleOpenInVSCode}>
              <FileCode size={16} />
              Open in VS Code
            </button>
          )}
          {projectState.isInstalled && (
            <button className="btn btn-danger-outline" onClick={handleUninstall}>
              <Trash2 size={16} />
              Uninstall
            </button>
          )}
          <button className="btn btn-ghost" onClick={handleOpenGitHub}>
            <ExternalLink size={16} />
            View on GitHub
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="details-stats">
        <div className="stat-item">
          <Star size={16} />
          <span>{repo.stargazers_count} stars</span>
        </div>
        <div className="stat-item">
          <GitFork size={16} />
          <span>{repo.forks_count} forks</span>
        </div>
        <div className="stat-item">
          <GitBranch size={16} />
          <span>{repo.default_branch}</span>
        </div>
        {repo.language && (
          <div className="stat-item">
            <Code size={16} />
            <span>{repo.language}</span>
          </div>
        )}
        <div className="stat-item">
          <Folder size={16} />
          <span>{formatSize(repo.size)}</span>
        </div>
        <div className="stat-item">
          <Clock size={16} />
          <span>Updated {formatDate(repo.updated_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="details-actions">
        {!projectState.isInstalled ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? (
              <>
                <RefreshCw size={18} className="spin" />
                Installing...
              </>
            ) : (
              <>
                <Download size={18} />
                Clone & Install
              </>
            )}
          </button>
        ) : (
          <>
            {!projectState.isRunning ? (
              <button
                className="btn btn-success btn-lg"
                onClick={handleRun}
                disabled={running}
              >
                {running ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Run Project
                  </>
                )}
              </button>
            ) : (
              <button className="btn btn-danger btn-lg" onClick={handleStop}>
                <Square size={18} />
                Stop
              </button>
            )}
            {projectState.port && (
              <button className="btn btn-secondary btn-lg" onClick={handleOpenInBrowser}>
                <ExternalLink size={18} />
                Open localhost:{projectState.port}
              </button>
            )}
          </>
        )}
      </div>

      {/* Progress */}
      {installing && (
        <div className="progress-section">
          <ProgressBar
            progress={installProgress}
            label="Installation Progress"
            variant={installProgress === 100 ? 'success' : 'primary'}
          />
        </div>
      )}

      {/* Terminal Output */}
      {terminalLines.length > 0 && (
        <div className="terminal-section">
          <TerminalOutput
            lines={terminalLines}
            title={`${repo.name} - Terminal`}
            onClear={() => setTerminalLines([])}
          />
        </div>
      )}
    </div>
  );
}

export default ProjectDetailsPage;
