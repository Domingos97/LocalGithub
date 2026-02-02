import { useState, useEffect } from 'react';
import {
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
  Link2,
  Unlink,
  FolderGit2,
  ArrowDownCircle,
  GitPullRequest,
} from 'lucide-react';
import ProgressBar from './ProgressBar';
import TerminalOutput from './TerminalOutput';
import Spinner from './Spinner';
import ProjectNotes from './ProjectNotes';
import { useToast } from './Toast';
import '../styles/ProjectDetailsPanel.css';

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
  clone_url?: string;
  default_branch?: string;
  private: boolean;
  size?: number;
  open_issues_count?: number;
}

interface ProjectDetailsPanelProps {
  repoName: string | null;
  repo?: Repository | null;
  isInstalled: boolean;
  localPath?: string;
  hasRemoteChanges?: boolean;
  behindCount?: number;
  onInstallComplete?: () => void;
  onUninstallComplete?: () => void;
  onPullComplete?: () => void;
}

function ProjectDetailsPanel({ 
  repoName, 
  repo: passedRepo,
  isInstalled: passedIsInstalled,
  localPath: passedLocalPath,
  hasRemoteChanges,
  behindCount,
  onInstallComplete,
  onUninstallComplete,
  onPullComplete
}: ProjectDetailsPanelProps) {
  const { addToast } = useToast();

  const [repo, setRepo] = useState<Repository | null>(passedRepo || null);
  const [isInstalled, setIsInstalled] = useState(passedIsInstalled);
  const [localPath, setLocalPath] = useState(passedLocalPath);
  const [loading, setLoading] = useState(!passedRepo);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [running, setRunning] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [port, setPort] = useState<number | undefined>();
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [runningProcessId, setRunningProcessId] = useState<string | null>(null);

  useEffect(() => {
    if (repoName && !passedRepo) {
      loadRepoDetails();
    } else if (passedRepo) {
      setRepo(passedRepo);
      setLoading(false);
    }
  }, [repoName, passedRepo]);

  useEffect(() => {
    setIsInstalled(passedIsInstalled);
    setLocalPath(passedLocalPath);
  }, [passedIsInstalled, passedLocalPath]);

  useEffect(() => {
    if (repoName) {
      checkInstallStatus();
    }
  }, [repoName]);

  const checkInstallStatus = async () => {
    if (!repoName) return;
    try {
      const result = await (window as any).electronAPI.project.isInstalled(repoName);
      if (result.success && result.data.installed) {
        const pathResult = await (window as any).electronAPI.git.getProjectPath(repoName);
        if (pathResult.success) {
          setIsInstalled(true);
          setLocalPath(pathResult.data.projectPath);
        }
      }
    } catch (error) {
      console.error('Error checking install status:', error);
    }
  };

  const loadRepoDetails = async () => {
    if (!repoName) return;
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

    const unsubscribe = (window as any).electronAPI.project.onInstallProgress((progress: any) => {
      setTerminalLines((prev) => [...prev, progress.message]);
      if (progress.progress) {
        setInstallProgress(progress.progress);
      }
    });

    try {
      const cloneUrl = repo.clone_url || `https://github.com/${repo.full_name}.git`;
      setTerminalLines((prev) => [...prev, `$ Cloning ${cloneUrl}...`]);

      const result = await (window as any).electronAPI.project.install(cloneUrl, repo.name);
      
      if (result.success) {
        setTerminalLines((prev) => [...prev, '✓ Installation complete']);
        setInstallProgress(100);
        
        const pathResult = await (window as any).electronAPI.git.getProjectPath(repo.name);
        if (pathResult.success) {
          setLocalPath(pathResult.data.projectPath);
        }
        setIsInstalled(true);
        onInstallComplete?.();
        addToast({ type: 'success', title: 'Installation Complete', message: `${repo.name} installed successfully` });
      } else {
        setTerminalLines((prev) => [...prev, `Error: ${result.error}`]);
        addToast({ type: 'error', title: 'Installation Failed', message: result.error });
      }
    } catch (error) {
      console.error('Installation error:', error);
      setTerminalLines((prev) => [...prev, `Error: ${error}`]);
      addToast({ type: 'error', title: 'Error', message: 'Installation failed' });
    } finally {
      setInstalling(false);
      unsubscribe();
    }
  };

  const handleRun = async () => {
    if (!repo || !localPath) return;

    setRunning(true);
    setTerminalLines((prev) => [...prev, '', '$ Detecting project configuration...']);

    try {
      // Get project configuration to determine the run command
      const configResult = await (window as any).electronAPI.project.getConfig(localPath);
      
      if (!configResult.success) {
        setTerminalLines((prev) => [...prev, `Error: Failed to detect project config - ${configResult.error}`]);
        addToast({ type: 'error', title: 'Failed to detect project', message: configResult.error });
        setRunning(false);
        return;
      }

      const config = configResult.data;
      const runCommand = config.devCommand || config.startCommand;

      if (!runCommand) {
        setTerminalLines((prev) => [...prev, 'Error: No run command found in project configuration']);
        addToast({ type: 'error', title: 'No run command', message: 'Could not find a start or dev script in this project' });
        setRunning(false);
        return;
      }

      setTerminalLines((prev) => [...prev, `$ ${runCommand}`]);

      // Determine port and type based on project
      const defaultPort = 3000;
      const processType = config.devCommand ? 'frontend' : 'other';

      const result = await (window as any).electronAPI.process.start(
        repo.name,
        runCommand,
        localPath,
        defaultPort,
        processType
      );
      
      if (result.success) {
        const newProcessId = result.data.id;
        setRunningProcessId(newProcessId);
        
        // Subscribe to process output - filter by this specific process ID
        (window as any).electronAPI.process.onOutput((data: any) => {
          // Only show output for this specific process
          if (data.processId === newProcessId) {
            setTerminalLines((prev) => [...prev, data.output]);
            
            const portMatch = data.output.match(/localhost:(\d+)/);
            if (portMatch) {
              setPort(parseInt(portMatch[1]));
            }
          }
        });
        
        setIsRunning(true);
        setPort(result.data.port);
        addToast({ type: 'success', title: 'Project Started', message: `${repo.name} is now running on port ${result.data.port}` });
      } else {
        setTerminalLines((prev) => [...prev, `Error: ${result.error}`]);
        addToast({ type: 'error', title: 'Failed to Start', message: result.error });
        setRunning(false);
      }
    } catch (error) {
      console.error('Run error:', error);
      setTerminalLines((prev) => [...prev, `Error: ${error}`]);
      addToast({ type: 'error', title: 'Error', message: 'Failed to start project' });
      setRunning(false);
    }
  };

  const handleStop = async () => {
    if (!repo || !runningProcessId) return;

    try {
      const result = await (window as any).electronAPI.process.stop(runningProcessId);
      
      if (result.success) {
        setIsRunning(false);
        setRunning(false);
        setRunningProcessId(null);
        setTerminalLines((prev) => [...prev, '', '$ Process stopped']);
        addToast({ type: 'info', title: 'Process Stopped', message: `${repo.name} has been stopped` });
      }
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  const handleOpenInBrowser = () => {
    if (port) {
      window.open(`http://localhost:${port}`, '_blank');
    }
  };

  const handleOpenGitHub = () => {
    if (repo?.html_url) {
      window.open(repo.html_url, '_blank');
    }
  };

  const handleOpenInVSCode = async () => {
    if (!localPath) return;
    try {
      const result = await (window as any).electronAPI.project.openInVSCode(localPath);
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
    if (!confirm(`Are you sure you want to uninstall ${repo.name}?`)) return;
    
    try {
      const result = await (window as any).electronAPI.project.uninstall(repo.name);
      if (result.success) {
        setIsInstalled(false);
        setLocalPath(undefined);
        setIsRunning(false);
        onUninstallComplete?.();
        addToast({ type: 'success', title: 'Uninstalled', message: `${repo.name} has been removed` });
      } else {
        addToast({ type: 'error', title: 'Uninstall Failed', message: result.error });
      }
    } catch (error) {
      console.error('Error uninstalling:', error);
      addToast({ type: 'error', title: 'Error', message: 'Failed to uninstall project' });
    }
  };

  const handleChangeLink = async () => {
    if (!repo) return;
    try {
      const result = await (window as any).electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Project Folder',
        buttonLabel: 'Select Folder'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const newPath = result.filePaths[0];
      const changeLinkResult = await (window as any).electronAPI.project.changeLink(repo.name, newPath);
      
      if (changeLinkResult.success) {
        setLocalPath(newPath);
        addToast({ type: 'success', title: 'Link Changed', message: changeLinkResult.message });
      } else {
        addToast({ type: 'error', title: 'Failed to Change Link', message: changeLinkResult.message });
      }
    } catch (error) {
      console.error('Error changing link:', error);
      addToast({ type: 'error', title: 'Error', message: 'Failed to change folder link' });
    }
  };

  const handleRemoveLink = async () => {
    if (!repo) return;
    
    if (!confirm(`Are you sure you want to unlink ${repo.name}? The folder will not be deleted.`)) {
      return;
    }

    try {
      const result = await (window as any).electronAPI.project.removeLink(repo.name);
      
      if (result.success) {
        setIsInstalled(false);
        setLocalPath(undefined);
        setIsRunning(false);
        onUninstallComplete?.();
        addToast({ type: 'success', title: 'Link Removed', message: result.message });
      } else {
        addToast({ type: 'error', title: 'Failed to Remove Link', message: result.message });
      }
    } catch (error) {
      console.error('Error removing link:', error);
      addToast({ type: 'error', title: 'Error', message: 'Failed to remove folder link' });
    }
  };

  const handlePull = async () => {
    if (!repo) return;
    
    setPulling(true);
    try {
      addToast({ type: 'info', title: 'Pulling Changes', message: `Pulling updates for ${repo.name}...` });
      
      const result = await (window as any).electronAPI.git.pull(repo.name);
      
      if (result.success && result.data.success) {
        addToast({ type: 'success', title: 'Pull Complete', message: result.data.message });
        onPullComplete?.();
      } else {
        addToast({ type: 'error', title: 'Pull Failed', message: result.data?.message || result.error || 'Unknown error' });
      }
    } catch (error) {
      console.error('Error pulling changes:', error);
      addToast({ type: 'error', title: 'Pull Error', message: String(error) });
    } finally {
      setPulling(false);
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

  // Empty state - no repo selected
  if (!repoName) {
    return (
      <div className="details-panel-empty">
        <div className="empty-icon">
          <FolderGit2 size={64} />
        </div>
        <h3>Select a Repository</h3>
        <p>Choose a repository from the list to view its details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="details-panel-loading">
        <Spinner size="lg" text="Loading project details..." />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="details-panel-error">
        <h3>Repository not found</h3>
        <p>Could not load details for this repository</p>
      </div>
    );
  }

  return (
    <div className="project-details-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-info">
          <div className="header-title-row">
            <h2>{repo.name}</h2>
            {hasRemoteChanges && isInstalled && (
              <span className="update-badge">
                <ArrowDownCircle size={12} />
                {behindCount && behindCount > 0 ? `${behindCount} update${behindCount > 1 ? 's' : ''}` : 'Update available'}
              </span>
            )}
            <span className={`visibility-badge ${repo.private ? 'private' : 'public'}`}>
              {repo.private ? <Lock size={12} /> : <Globe size={12} />}
              {repo.private ? 'Private' : 'Public'}
            </span>
          </div>
          <p className="header-description">{repo.description || 'No description'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="panel-stats">
        <div className="stat-item">
          <Star size={14} />
          <span>{repo.stargazers_count}</span>
        </div>
        <div className="stat-item">
          <GitFork size={14} />
          <span>{repo.forks_count}</span>
        </div>
        {repo.default_branch && (
          <div className="stat-item">
            <GitBranch size={14} />
            <span>{repo.default_branch}</span>
          </div>
        )}
        {repo.language && (
          <div className="stat-item">
            <Code size={14} />
            <span>{repo.language}</span>
          </div>
        )}
        {repo.size && (
          <div className="stat-item">
            <Folder size={14} />
            <span>{formatSize(repo.size)}</span>
          </div>
        )}
        <div className="stat-item">
          <Clock size={14} />
          <span>{formatDate(repo.updated_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="panel-actions">
        {!isInstalled ? (
          <button
            className="btn btn-primary"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? (
              <>
                <RefreshCw size={16} className="spin" />
                Installing...
              </>
            ) : (
              <>
                <Download size={16} />
                Clone & Install
              </>
            )}
          </button>
        ) : (
          <>
            {!isRunning ? (
              <button
                className="btn btn-success"
                onClick={handleRun}
                disabled={running}
              >
                {running ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Run
                  </>
                )}
              </button>
            ) : (
              <button className="btn btn-danger" onClick={handleStop}>
                <Square size={16} />
                Stop
              </button>
            )}
            {port && (
              <button className="btn btn-secondary" onClick={handleOpenInBrowser}>
                <ExternalLink size={16} />
                Open :{ port}
              </button>
            )}
            {hasRemoteChanges && (
              <button 
                className="btn btn-warning" 
                onClick={handlePull}
                disabled={pulling}
              >
                {pulling ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Pulling...
                  </>
                ) : (
                  <>
                    <GitPullRequest size={16} />
                    Pull {behindCount && behindCount > 0 ? `(${behindCount})` : ''}
                  </>
                )}
              </button>
            )}
            {!hasRemoteChanges && (
              <button 
                className="btn btn-secondary" 
                onClick={handlePull}
                disabled={pulling}
              >
                {pulling ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Pulling...
                  </>
                ) : (
                  <>
                    <GitPullRequest size={16} />
                    Pull
                  </>
                )}
              </button>
            )}
          </>
        )}
        <button className="btn btn-ghost" onClick={handleOpenGitHub}>
          <ExternalLink size={16} />
          GitHub
        </button>
      </div>

      {/* Installed Project Actions */}
      {isInstalled && localPath && (
        <div className="panel-installed-actions">
          <button className="btn btn-vscode" onClick={handleOpenInVSCode}>
            <FileCode size={16} />
            Open in VS Code
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleChangeLink}>
            <Link2 size={14} />
            Change Link
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleRemoveLink}>
            <Unlink size={14} />
            Unlink
          </button>
          <button className="btn btn-danger-outline btn-sm" onClick={handleUninstall}>
            <Trash2 size={14} />
            Uninstall
          </button>
        </div>
      )}

      {/* Local Path */}
      {isInstalled && localPath && (
        <div className="panel-local-path">
          <Folder size={14} />
          <span title={localPath}>{localPath}</span>
        </div>
      )}

      {/* Progress */}
      {installing && (
        <div className="panel-progress">
          <ProgressBar
            progress={installProgress}
            label="Installation Progress"
            variant={installProgress === 100 ? 'success' : 'primary'}
          />
        </div>
      )}

      {/* Project Notes */}
      {repo && <ProjectNotes repoName={repo.full_name} />}

      {/* Terminal Output */}
      {terminalLines.length > 0 && (
        <div className="panel-terminal">
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

export default ProjectDetailsPanel;
