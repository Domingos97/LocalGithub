import React, { useState, useMemo } from 'react';
import { Star, GitFork, Clock, Lock, Globe, Download, Check, Loader, Code, Trash2, GitPullRequest, AlertCircle, Link, User, FolderEdit, Folder } from 'lucide-react';
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
  onChangeLocation?: (repoName: string) => Promise<void>;
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

function ProjectCard({ repo, onSelect, isInstalled, onInstall, onLinkExisting, localPath, onOpenInVSCode, onUninstall, style, hasRemoteChanges, behindCount, onPull, onChangeLocation }: ProjectCardProps) {
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [linking, setLinking] = useState(false);
  const [changingLocation, setChangingLocation] = useState(false);
  
  // Extract owner from full_name (e.g., "ebywater/Cubular_Frontend")
  const owner = useMemo(() => {
    if (repo.full_name) {
      return repo.full_name.split('/')[0];
    }
    return null;
  }, [repo.full_name]);
  
  // Memoize expensive date calculations
  const timeAgo = useMemo(() => {
    const updatedDate = new Date(repo.updated_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - updatedDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)} weeks ago`;
    } else if (diffDays < 365) {
      return `${Math.floor(diffDays / 30)} months ago`;
    } else {
      return `${Math.floor(diffDays / 365)} years ago`;
    }
  }, [repo.updated_at]);

  // Memoize language color lookup
  const langColor = useMemo(() => 
    repo.language ? languageColors[repo.language] || '#6e7681' : '#6e7681',
    [repo.language]
  );

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    e.stopPropagation();
    if (onOpenInVSCode && localPath) {
      onOpenInVSCode(localPath);
    }
  };

  const handleUninstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUninstall || uninstalling || !isInstalled) return;
    
    setUninstalling(true);
    try {
      await onUninstall(repo.name);
    } finally {
      setUninstalling(false);
    }
  };

  const handlePull = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pulling || !isInstalled) return;
    
    setPulling(true);
    try {
      if (onPull) {
        await onPull(repo.name);
      }
    } finally {
      setPulling(false);
    }
  };

  const handleLinkExisting = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onLinkExisting || linking || isInstalled) return;
    
    const cloneUrl = repo.clone_url || `https://github.com/${repo.full_name}.git`;
    setLinking(true);
    try {
      await onLinkExisting(repo.name, cloneUrl);
    } finally {
      setLinking(false);
    }
  };

  const handleChangeLocation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onChangeLocation || changingLocation || !isInstalled) return;
    
    setChangingLocation(true);
    try {
      await onChangeLocation(repo.name);
    } finally {
      setChangingLocation(false);
    }
  };

  return (
    <div className="project-card animate-slideUp" onClick={onSelect} style={style}>
      <div className="card-header">
        <div className="card-title-row">
          <h3 className="card-title">{repo.name}</h3>
          <div className="card-badges">
            {owner && (
              <span className="owner-badge" title={`Owner: ${owner}`}>
                <User size={12} />
                {owner}
              </span>
            )}
            {isInstalled && hasRemoteChanges && (
              <span className="remote-changes-badge" title={`${behindCount} commit(s) behind`}>
                <AlertCircle size={12} />
                Update
              </span>
            )}
            {isInstalled && hasRemoteChanges === false && (
              <span className="up-to-date-badge" title="Local repository is up to date">
                <Check size={12} />
                Updated
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

      <div className="card-meta">
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
          <span className="stat-item updated-time">
            <Clock size={12} />
            {timeAgo}
          </span>
        </div>
      </div>

      {isInstalled && localPath && (
        <div className="local-path-section">
          <div className="local-path-row">
            <Folder size={14} className="path-icon" />
            <span className="local-path" title={localPath}>{localPath}</span>
            {onChangeLocation && (
              <button
                className={`path-change-btn ${changingLocation ? 'loading' : ''}`}
                onClick={handleChangeLocation}
                disabled={changingLocation}
                title="Change local folder location"
              >
                {changingLocation ? (
                  <Loader size={12} className="spin" />
                ) : (
                  <FolderEdit size={12} />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card-actions">
        {/* Primary Actions */}
        {!isInstalled && onInstall && (
          <>
            <button
              className={`btn btn-primary ${installing ? 'loading' : ''}`}
              onClick={handleInstallClick}
              disabled={installing}
              title="Install project locally"
            >
              {installing ? (
                <>
                  <Loader size={14} className="spin" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Install</span>
                </>
              )}
            </button>
            {onLinkExisting && (
              <button
                className={`btn btn-secondary ${linking ? 'loading' : ''}`}
                onClick={handleLinkExisting}
                disabled={linking}
                title="Link an existing local folder"
              >
                {linking ? (
                  <>
                    <Loader size={14} className="spin" />
                    <span>Linking...</span>
                  </>
                ) : (
                  <>
                    <Link size={14} />
                    <span>Link</span>
                  </>
                )}
              </button>
            )}
          </>
        )}

        {isInstalled && (
          <>
            {localPath && onOpenInVSCode && (
              <button
                className="btn btn-primary"
                onClick={handleOpenInVSCode}
                title="Open in Visual Studio Code"
              >
                <Code size={14} />
                <span>Open in VS Code</span>
              </button>
            )}
            <button
              className={`btn btn-secondary ${hasRemoteChanges ? 'btn-warning' : ''} ${pulling ? 'loading' : ''}`}
              onClick={handlePull}
              disabled={pulling}
              title={hasRemoteChanges ? `Pull ${behindCount} commit(s) from remote` : 'Pull latest changes'}
            >
              {pulling ? (
                <>
                  <Loader size={14} className="spin" />
                  <span>Pulling...</span>
                </>
              ) : (
                <>
                  <GitPullRequest size={14} />
                  <span>{hasRemoteChanges ? `Pull (${behindCount})` : 'Pull'}</span>
                </>
              )}
            </button>
            {onUninstall && (
              <button
                className={`btn btn-danger ${uninstalling ? 'loading' : ''}`}
                onClick={handleUninstall}
                disabled={uninstalling}
                title="Uninstall project"
              >
                {uninstalling ? (
                  <>
                    <Loader size={14} className="spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Uninstall</span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(ProjectCard);
