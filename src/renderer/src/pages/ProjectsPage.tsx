import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, FolderGit2, AlertCircle } from 'lucide-react';
import RepoListItem from '../components/RepoListItem';
import ProjectDetailsPanel from '../components/ProjectDetailsPanel';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import '../styles/Projects.css';

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
  private: boolean;
}

interface DatabaseInfo {
  hasDatabase: boolean;
  type?: 'sqlite' | 'prisma' | 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'unknown';
  isConfigured: boolean;
  isConnected?: boolean;
  isCreated?: boolean;
  configFile?: string;
  details?: string;
  setupCommand?: string;
  packageManager?: string;
}

function ProjectsPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'not-installed'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [installedProjects, setInstalledProjects] = useState<Set<string>>(new Set());
  const [projectPaths, setProjectPaths] = useState<Record<string, string>>({});
  const [remoteChanges, setRemoteChanges] = useState<Record<string, { hasChanges: boolean; behindCount: number }>>({});
  const [databaseStatus, setDatabaseStatus] = useState<Record<string, DatabaseInfo>>({});
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadRepositories();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const result = await (window as any).electronAPI.github.getAllRepositories();
      if (result.success) {
        setRepos(result.data);
        // Check which repos are already installed
        await checkInstalledProjects(result.data);
      } else {
        console.error('Failed to load repositories:', result.error);
      }
    } catch (error) {
      console.error('Error loading repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkInstalledProjects = async (repositories: Repository[]) => {
    const installed = new Set<string>();
    const paths: Record<string, string> = {};
    const dbInfo: Record<string, DatabaseInfo> = {};
    
    try {
      // Use batch check API - single call for all repos
      const result = await (window as any).electronAPI.project.batchCheck(
        repositories.map(r => r.name)
      );
      
      if (result.success) {
        result.data.forEach((item: any) => {
          if (item.installed) {
            installed.add(item.name);
            if (item.path) {
              paths[item.name] = item.path;
            }
            if (item.database) {
              dbInfo[item.name] = item.database;
            }
          }
        });
      }
    } catch (error) {
      console.error('Batch check error:', error);
      // Fallback to individual checks if batch fails
      const results = await Promise.allSettled(
        repositories.map(async (repo) => {
          const result = await (window as any).electronAPI.project.isInstalled(repo.name);
          if (result.success && result.data.installed) {
            const pathResult = await (window as any).electronAPI.git.getProjectPath(repo.name);
            return {
              name: repo.name,
              path: pathResult.success ? pathResult.data.projectPath : null
            };
          }
          return null;
        })
      );
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          installed.add(result.value.name);
          if (result.value.path) {
            paths[result.value.name] = result.value.path;
          }
        }
      });
    }
    
    setInstalledProjects(installed);
    setProjectPaths(paths);
    setDatabaseStatus(dbInfo);
    
    // Check for remote changes in background (non-blocking)
    // Only check installed projects
    if (installed.size > 0) {
      checkRemoteChangesInBackground(Array.from(installed));
    }
    
    console.log('Installed projects:', installed);
    console.log('Database status:', dbInfo);
  };
  
  const checkRemoteChangesInBackground = async (installedRepoNames: string[]) => {
    // Run in background without blocking UI
    // Use fetchAndCheckRemoteChanges to get accurate results (fetches from remote first)
    const results = await Promise.allSettled(
      installedRepoNames.map(async (repoName) => {
        try {
          const changesResult = await (window as any).electronAPI.git.fetchAndCheckRemoteChanges(repoName);
          if (changesResult.success) {
            return {
              name: repoName,
              hasChanges: changesResult.data.hasChanges,
              behindCount: changesResult.data.behind
            };
          }
        } catch (error) {
          console.warn(`Failed to check remote changes for ${repoName}:`, error);
        }
        return null;
      })
    );
    
    const newChanges: Record<string, { hasChanges: boolean; behindCount: number }> = {};
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        newChanges[result.value.name] = {
          hasChanges: result.value.hasChanges,
          behindCount: result.value.behindCount
        };
      }
    });
    
    setRemoteChanges(newChanges);
    console.log('Remote changes:', newChanges);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRepositories();
    setRefreshing(false);
  };

  // Memoized filtered repositories for the list
  const filteredRepos = useMemo(() => {
    let filtered = repos;

    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchLower) ||
          (repo.description?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    if (languageFilter !== 'all') {
      filtered = filtered.filter((repo) => repo.language === languageFilter);
    }

    if (statusFilter === 'installed') {
      filtered = filtered.filter((repo) => installedProjects.has(repo.name));
    } else if (statusFilter === 'not-installed') {
      filtered = filtered.filter((repo) => !installedProjects.has(repo.name));
    }

    return filtered;
  }, [repos, debouncedSearchTerm, languageFilter, statusFilter, installedProjects]);

  // Get selected repository object
  const selectedRepoObj = useMemo(() => {
    return repos.find(r => r.name === selectedRepo) || null;
  }, [repos, selectedRepo]);

  // Memoize language list calculation
  const languages = useMemo(() => 
    ['all', ...new Set(repos.map((r) => r.language).filter((l): l is string => l !== null))],
    [repos]
  );

  // Handle install/uninstall updates
  const handleInstallComplete = () => {
    if (selectedRepo) {
      setInstalledProjects(prev => new Set([...prev, selectedRepo]));
      loadRepositories(); // Refresh to get updated paths
    }
  };

  const handleUninstallComplete = () => {
    if (selectedRepo) {
      setInstalledProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedRepo);
        return newSet;
      });
      setProjectPaths(prev => {
        const newPaths = { ...prev };
        delete newPaths[selectedRepo];
        return newPaths;
      });
    }
  };

  const handlePullComplete = () => {
    if (selectedRepo) {
      // Clear remote changes for this repo after successful pull
      setRemoteChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[selectedRepo];
        return newChanges;
      });
    }
  };

  if (loading) {
    return (
      <div className="projects-loading">
        <Spinner size="lg" text="Loading repositories..." />
      </div>
    );
  }

  return (
    <div className="projects-page split-layout animate-fadeIn">
      {/* Left Panel - Repository List */}
      <div className="repo-list-panel">
        <div className="repo-list-header">
          <h2 className="repo-list-title">
            <FolderGit2 size={18} />
            Repositories
            <span className="repo-count">{filteredRepos.length}</span>
          </h2>
        </div>
        
        {/* Filters */}
        <div className="repo-list-filters">
          <div className="search-wrapper compact">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-row">
            <select
              className="filter-select"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'all' ? 'All' : lang}
                </option>
              ))}
            </select>
            
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'installed' | 'not-installed')}
            >
              <option value="all">All Status</option>
              <option value="installed">Installed</option>
              <option value="not-installed">Not Installed</option>
            </select>
          </div>
        </div>

        {/* Repository List */}
        <div className="repo-list-content">
          {filteredRepos.length > 0 ? (
            filteredRepos.map((repo) => (
              <RepoListItem
                key={repo.id}
                repo={repo}
                isInstalled={installedProjects.has(repo.name)}
                hasRemoteChanges={remoteChanges[repo.name]?.hasChanges}
                behindCount={remoteChanges[repo.name]?.behindCount}
                databaseInfo={databaseStatus[repo.name]}
                isSelected={selectedRepo === repo.name}
                onSelect={() => setSelectedRepo(repo.name)}
                onInstall={() => {
                  setSelectedRepo(repo.name);
                }}
              />
            ))
          ) : (
            <div className="repo-list-empty">
              <AlertCircle size={24} />
              <p>No repositories found</p>
            </div>
          )}
        </div>

        {/* List Footer */}
        <div className="repo-list-footer">
          <button 
            className={`btn btn-secondary btn-sm ${refreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Right Panel - Project Details */}
      <div className="project-details-container">
        <ProjectDetailsPanel
          repoName={selectedRepo}
          repo={selectedRepoObj}
          isInstalled={selectedRepo ? installedProjects.has(selectedRepo) : false}
          localPath={selectedRepo ? projectPaths[selectedRepo] : undefined}
          hasRemoteChanges={selectedRepo ? remoteChanges[selectedRepo]?.hasChanges : false}
          behindCount={selectedRepo ? remoteChanges[selectedRepo]?.behindCount : 0}
          onInstallComplete={handleInstallComplete}
          onUninstallComplete={handleUninstallComplete}
          onPullComplete={handlePullComplete}
        />
      </div>
    </div>
  );
}

export default ProjectsPage;
