import { useState } from 'react';
import { Star, GitFork, Clock, Lock, Globe, Download, Check, Loader, Code, Trash2, GitPullRequest, AlertCircle, Link } from 'lucide-react';
import '../styles/ProjectCard.css';

interface ProjectCardProps {
  repo: {
    name: string;
    full_name?: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count?: number;
    updated_at: string;
    private?: boolean;
    clone_url?: string;
    html_url?: string;
  };
  onSelect: () => void;
  isInstalled?: boolean;
  onInstall?: (repoUrl: string, repoName: string) => Promise<void>;
  onLinkExisting?: (repoName: string, repoUrl: string) => Promise<void>;
  localPath?: string;
  onOpenInVSCode?: (projectPath: string) => void;
  onUninstall?: (repoName: string) => Promise<void>;
  style?: React.CSSProperties;
  hasRemoteChanges?: boolean;
  behindCount?: number;
  onPull?: (repoName: string) => Promise<void>;
}

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#ffac45',
  Kotlin: '#A97BFF',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Dart: '#00B4AB',
};

function ProjectCard({ repo, onSelect, isInstalled, onInstall, onLinkExisting, localPath, onOpenInVSCode, onUninstall, style, hasRemoteChanges, behindCount, onPull }: ProjectCardProps) {
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [linking, setLinking] = useState(false);
  
  // Debug logging
  if (isInstalled) {
    console.log(`ProjectCard ${repo.name}:`, { isInstalled, hasRemoteChanges, behindCount, onPull: !!onPull });
  }
  
  const updatedDate = new Date(repo.updated_at);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - updatedDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let timeAgo: string;
  if (diffDays === 0) {
    timeAgo = 'Today';
  } else if (diffDays === 1) {
    timeAgo = 'Yesterday';
  } else if (diffDays < 7) {
    timeAgo = `${diffDays} days ago`;
  } else if (diffDays < 30) {
    timeAgo = `${Math.floor(diffDays / 7)} weeks ago`;
  } else if (diffDays < 365) {
    timeAgo = `${Math.floor(diffDays / 30)} months ago`;
  } else {
    timeAgo = `${Math.floor(diffDays / 365)} years ago`;
  }

  const langColor = repo.language ? languageColors[repo.language] || '#6e7681' : '#6e7681';

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!onInstall || installing || isInstalled) return;
    
    const cloneUrl = repo.clone_url || `https://github.com/${repo.full_name}.git`;
    setInstalling(true);
    try {
      await onInstall(cloneUrl, repo.name);
    } finally {
      setInstalling(false);
    }
  };

  const handleOpenInVSCode = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (onOpenInVSCode && localPath) {
      onOpenInVSCode(localPath);
    }
  };

  const handleUninstall = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!onUninstall || uninstalling || !isInstalled) return;
    
    setUninstalling(true);
    try {
      await onUninstall(repo.name);
    } finally {
      setUninstalling(false);
    }
  };

  const handlePull = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!onPull || pulling || !isInstalled) return;
    
    setPulling(true);
    try {
      await onPull(repo.name);
    } finally {
      setPulling(false);
    }
  };

  const handleLinkExisting = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!onLinkExisting || linking || isInstalled) return;
    
    const cloneUrl = repo.clone_url || `https://github.com/${repo.full_name}.git`;
    setLinking(true);
    try {
      await onLinkExisting(repo.name, cloneUrl);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="project-card animate-slideUp" onClick={onSelect} style={style}>
      <div className="card-header">
        <div className="card-title-row">
          <h3 className="card-title">{repo.name}</h3>
          <div className="card-badges">
            {isInstalled && hasRemoteChanges && (
              <span className="remote-changes-badge" title={`${behindCount} commit(s) behind`}>
                <AlertCircle size={12} />
                Update Available
              </span>
            )}
            {isInstalled && hasRemoteChanges === false && (
              <span className="up-to-date-badge" title="Local repository is up to date">
                <Check size={12} />
                Up to Date
              </span>
            )}
            {isInstalled && (
              <span className="installed-badge">
                <Check size={12} />
                Installed
              </span>
            )}
            <span className={`visibility-badge ${repo.private ? 'private' : 'public'}`}>
              {repo.private ? <Lock size={12} /> : <Globe size={12} />}
              {repo.private ? 'Private' : 'Public'}
            </span>
          </div>
        </div>
      </div>

      <p className="card-description">
        {repo.description || 'No description available'}
      </p>

      <div className="card-footer">
        <div className="card-stats">
          {repo.language && (
            <span className="stat-item language">
              <span className="language-dot" style={{ backgroundColor: langColor }} />
              {repo.language}
            </span>
          )}
          <span className="stat-item">
            <Star size={14} />
            {repo.stargazers_count}
          </span>
          {repo.forks_count !== undefined && (
            <span className="stat-item">
              <GitFork size={14} />
              {repo.forks_count}
            </span>
          )}
        </div>
        <div className="card-actions">
          <span className="updated-time">
            <Clock size={12} />
            {timeAgo}
          </span>
          {isInstalled && onPull && (
            <button
              className={`pull-btn ${hasRemoteChanges ? 'has-updates' : ''} ${pulling ? 'pulling' : ''}`}
              onClick={handlePull}
              disabled={pulling}
              title={hasRemoteChanges ? `Pull ${behindCount} commit(s) from remote` : 'Check for updates and pull if available'}
            >
              {pulling ? (
                <>
                  <Loader size={14} className="spin" />
                  Pulling...
                </>
              ) : hasRemoteChanges ? (
                <>
                  <GitPullRequest size={14} />
                  Pull Changes
                </>
              ) : (
                <>
                  <GitPullRequest size={14} />
                  Sync
                </>
              )}
            </button>
          )}
          {isInstalled && localPath && onOpenInVSCode && (
            <button
              className="vscode-btn"
              onClick={handleOpenInVSCode}
              title="Open in Visual Studio Code"
            >
              <Code size={14} />
              Open in VS Code
            </button>
          )}
          {isInstalled && onUninstall && (
            <button
              className={`uninstall-btn ${uninstalling ? 'uninstalling' : ''}`}
              onClick={handleUninstall}
              disabled={uninstalling}
              title="Uninstall project"
            >
              {uninstalling ? (
                <>
                  <Loader size={14} className="spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Uninstall
                </>
              )}
            </button>
          )}
          {onInstall && (
            <button
              className={`install-btn ${isInstalled ? 'installed' : ''} ${installing ? 'installing' : ''}`}
              onClick={handleInstallClick}
              disabled={installing || isInstalled}
              title={isInstalled ? 'Already installed' : 'Install project locally'}
            >
              {installing ? (
                <>
                  <Loader size={14} className="spin" />
                  Installing...
                </>
              ) : isInstalled ? (
                <>
                  <Check size={14} />
                  Installed
                </>
              ) : (
                <>
                  <Download size={14} />
                  Install
                </>
              )}
            </button>
          )}
          {onInstall && !isInstalled && onLinkExisting && (
            <button
              className={`link-btn ${linking ? 'linking' : ''}`}
              onClick={handleLinkExisting}
              disabled={linking}
              title="Link an existing local folder to this repository"
            >
              {linking ? (
                <>
                  <Loader size={14} className="spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link size={14} />
                  Link Existing
                </>
              )}
            </button>
          )}
              ) : isInstalled ? (
                <>
                  <Check size={14} />
                  Installed
                </>
              ) : (
                <>
                  <Download size={14} />
                  Install
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;
