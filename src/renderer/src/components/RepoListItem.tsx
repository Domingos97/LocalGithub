import { useMemo } from 'react';
import { Star, Lock, Globe, Download, Check, GitPullRequest, Database } from 'lucide-react';
import '../styles/RepoListItem.css';

interface DatabaseInfo {
  hasDatabase: boolean;
  type?: string;
  isConfigured: boolean;
}

interface RepoListItemProps {
  repo: {
    id: number;
    name: string;
    full_name?: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    updated_at: string;
    private?: boolean;
  };
  isInstalled: boolean;
  hasRemoteChanges?: boolean;
  behindCount?: number;
  databaseInfo?: DatabaseInfo | null;
  onInstall?: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
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

function RepoListItem({ 
  repo, 
  isInstalled, 
  hasRemoteChanges, 
  behindCount, 
  databaseInfo,
  onInstall, 
  onSelect,
  isSelected 
}: RepoListItemProps) {
  const langColor = useMemo(() => 
    repo.language ? languageColors[repo.language] || '#6e7681' : '#6e7681',
    [repo.language]
  );

  const owner = useMemo(() => {
    if (repo.full_name) {
      return repo.full_name.split('/')[0];
    }
    return null;
  }, [repo.full_name]);

  return (
    <div 
      className={`repo-list-item ${isInstalled ? 'installed' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="repo-list-item-main">
        <div className="repo-list-item-header">
          <span className="repo-list-item-visibility">
            {repo.private ? <Lock size={12} /> : <Globe size={12} />}
          </span>
          <span className="repo-list-item-name">{repo.name}</span>
          {owner && (
            <span className="repo-list-item-owner">/{owner}</span>
          )}
        </div>
        
        {repo.description && (
          <p className="repo-list-item-desc">{repo.description}</p>
        )}
        
        <div className="repo-list-item-meta">
          {repo.language && (
            <span className="repo-list-item-lang">
              <span 
                className="lang-dot" 
                style={{ backgroundColor: langColor }}
              />
              {repo.language}
            </span>
          )}
          {repo.stargazers_count > 0 && (
            <span className="repo-list-item-stars">
              <Star size={12} />
              {repo.stargazers_count}
            </span>
          )}
          {databaseInfo?.hasDatabase && (
            <span className="repo-list-item-db">
              <Database size={12} />
            </span>
          )}
        </div>
      </div>

      <div className="repo-list-item-status">
        {isInstalled ? (
          <>
            {hasRemoteChanges && behindCount && behindCount > 0 ? (
              <span className="status-badge has-updates" title={`${behindCount} commits behind`}>
                <GitPullRequest size={14} />
                {behindCount}
              </span>
            ) : (
              <span className="status-badge installed" title="Installed locally">
                <Check size={14} />
              </span>
            )}
          </>
        ) : (
          <button 
            className="install-btn-small"
            onClick={(e) => {
              e.stopPropagation();
              onInstall?.();
            }}
            title="Install repository"
          >
            <Download size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default RepoListItem;
