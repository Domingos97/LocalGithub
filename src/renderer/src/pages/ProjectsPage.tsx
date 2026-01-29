import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, FolderGit2, AlertCircle, Folder, FolderOpen } from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
import ProjectGroupsModal from '../components/ProjectGroupsModal';
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

interface ProjectGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  repoNames: string[];
  createdAt: string;
  updatedAt: string;
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
  const [refreshing, setRefreshing] = useState(false);
  const [installedProjects, setInstalledProjects] = useState<Set<string>>(new Set());
  const [projectPaths, setProjectPaths] = useState<Record<string, string>>({});
  const [remoteChanges, setRemoteChanges] = useState<Record<string, { hasChanges: boolean; behindCount: number }>>({});
  const [databaseStatus, setDatabaseStatus] = useState<Record<string, DatabaseInfo>>({});
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'grouped' | 'by-owner'>('all');
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    loadRepositories();
    loadGroups();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadGroups = async () => {
    try {
      const result = await (window as any).electronAPI.groups.getAll();
      if (result.success) {
        setGroups(result.data || []);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

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
    const results = await Promise.allSettled(
      installedRepoNames.map(async (repoName) => {
        try {
          const changesResult = await (window as any).electronAPI.git.checkRemoteChanges(repoName);
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

  const handleInstall = async (repoUrl: string, repoName: string) => {
    // Set up progress listener
    const unsubscribe = (window as any).electronAPI.project.onInstallProgress((progress: any) => {
      console.log('Install progress:', progress);
      // Could show a toast or update UI with progress
      if (progress.stage === 'installing') {
        addToast({ 
          type: 'info', 
          title: 'Installing', 
          message: progress.message 
        });
      }
    });

    try {
      addToast({ 
        type: 'info', 
        title: 'Starting Installation', 
        message: `Installing ${repoName}...` 
      });

      const result = await (window as any).electronAPI.project.install(repoUrl, repoName);
      
      if (result.success) {
        setInstalledProjects(prev => new Set([...prev, repoName]));
        // Get the project path after installation
        const pathResult = await (window as any).electronAPI.git.getProjectPath(repoName);
        if (pathResult.success) {
          const projectPath = pathResult.data.projectPath;
          setProjectPaths(prev => ({ ...prev, [repoName]: projectPath }));
          
          // Check for database status after installation
          try {
            const dbResult = await (window as any).electronAPI.project.checkDatabase(projectPath);
            if (dbResult.success && dbResult.data) {
              setDatabaseStatus(prev => ({ ...prev, [repoName]: dbResult.data }));
            }
          } catch (dbError) {
            console.warn('Failed to check database status:', dbError);
          }
        }
        addToast({ 
          type: 'success', 
          title: 'Installation Complete', 
          message: `${repoName} has been installed successfully!` 
        });
      } else {
        addToast({ 
          type: 'error', 
          title: 'Installation Failed', 
          message: result.error || 'Unknown error occurred' 
        });
      }
    } catch (error) {
      addToast({ 
        type: 'error', 
        title: 'Installation Error', 
        message: String(error) 
      });
    } finally {
      unsubscribe();
    }
  };

  const handleOpenInVSCode = async (projectPath: string) => {
    try {
      const result = await (window as any).electronAPI.project.openInVSCode(projectPath);
      if (result.success) {
        addToast({ 
          type: 'success', 
          title: 'Opening VS Code', 
          message: 'Opening project in Visual Studio Code' 
        });
      } else {
        addToast({ 
          type: 'error', 
          title: 'Failed to open VS Code', 
          message: result.error 
        });
      }
    } catch (error) {
      addToast({ 
        type: 'error', 
        title: 'Error', 
        message: 'Failed to open in Visual Studio Code' 
      });
    }
  };

  const handleUninstall = async (repoName: string) => {
    try {
      const result = await (window as any).electronAPI.project.uninstall(repoName);
      if (result.success) {
        setInstalledProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(repoName);
          return newSet;
        });
        setProjectPaths(prev => {
          const newPaths = { ...prev };
          delete newPaths[repoName];
          return newPaths;
        });
        setRemoteChanges(prev => {
          const newChanges = { ...prev };
          delete newChanges[repoName];
          return newChanges;
        });
        setDatabaseStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[repoName];
          return newStatus;
        });
        addToast({ 
          type: 'success', 
          title: 'Uninstalled', 
          message: `${repoName} has been removed` 
        });
      } else {
        addToast({ 
          type: 'error', 
          title: 'Uninstall Failed', 
          message: result.error 
        });
      }
    } catch (error) {
      addToast({ 
        type: 'error', 
        title: 'Error', 
        message: 'Failed to uninstall project' 
      });
    }
  };

  const handlePull = async (repoName: string) => {
    try {
      addToast({ 
        type: 'info', 
        title: 'Pulling Changes', 
        message: `Pulling updates for ${repoName}...` 
      });

      const result = await (window as any).electronAPI.git.pull(repoName);
      
      if (result.success && result.data.success) {
        // After successful pull, update remote changes status
        setRemoteChanges(prev => ({
          ...prev,
          [repoName]: { hasChanges: false, behindCount: 0 }
        }));
        
        addToast({ 
          type: 'success', 
          title: 'Pull Complete', 
          message: result.data.message 
        });
      } else {
        addToast({ 
          type: 'error', 
          title: 'Pull Failed', 
          message: result.data?.message || result.error || 'Unknown error occurred' 
        });
      }
    } catch (error) {
      addToast({ 
        type: 'error', 
        title: 'Pull Error', 
        message: String(error) 
      });
    }
  };

  const handleLinkExisting = async (repoName: string, repoUrl: string) => {
    try {
      // Open folder picker
      const folderResult = await (window as any).electronAPI.dialog.selectFolder();
      if (!folderResult.success || folderResult.canceled) {
        return;
      }

      addToast({ 
        type: 'info', 
        title: 'Linking Folder', 
        message: `Linking ${repoName} to existing folder...` 
      });

      const result = await (window as any).electronAPI.project.linkExisting(
        folderResult.path, 
        repoUrl, 
        repoName
      );
      
      if (result.success) {
        setInstalledProjects(prev => new Set([...prev, repoName]));
        setProjectPaths(prev => ({ ...prev, [repoName]: folderResult.path }));
        addToast({ 
          type: 'success', 
          title: 'Folder Linked', 
          message: result.message 
        });
      } else {
        addToast({ 
          type: 'error', 
          title: 'Link Failed', 
          message: result.message || 'Failed to link folder' 
        });
      }
    } catch (error) {
      addToast({ 
        type: 'error', 
        title: 'Link Error', 
        message: String(error) 
      });
    }
  };

  const handleChangeLocation = async (repoName: string) => {
    try {
      // Open folder picker
      const result = await (window as any).electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select New Project Folder',
        buttonLabel: 'Select Folder'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const newPath = result.filePaths[0];
      
      addToast({ 
        type: 'info', 
        title: 'Changing Location', 
        message: `Changing location for ${repoName}...` 
      });

      const changeLinkResult = await (window as any).electronAPI.project.changeLink(repoName, newPath);
      
      if (changeLinkResult.success) {
        setProjectPaths(prev => ({ ...prev, [repoName]: newPath }));
        addToast({ 
          type: 'success', 
          title: 'Location Changed', 
          message: changeLinkResult.message 
        });
      } else {
        addToast({ 
          type: 'error', 
          title: 'Failed to Change Location', 
          message: changeLinkResult.message || 'Unknown error occurred'
        });
      }
    } catch (error) {
      addToast({ 
        type: 'error', 
        title: 'Error', 
        message: 'Failed to change folder location' 
      });
    }
  };

  const handleSetupDatabase = async (repoName: string, projectPath: string) => {
    try {
      addToast({ 
        type: 'info', 
        title: 'Setting Up Database', 
        message: `Running database setup for ${repoName}...` 
      });

      const result = await (window as any).electronAPI.project.setupDatabase(projectPath);
      
      if (result.success) {
        // Refresh database status
        try {
          const dbResult = await (window as any).electronAPI.project.checkDatabase(projectPath);
          if (dbResult.success && dbResult.data) {
            setDatabaseStatus(prev => ({ ...prev, [repoName]: dbResult.data }));
          }
        } catch (dbError) {
          console.warn('Failed to refresh database status:', dbError);
        }
        
        addToast({ 
          type: 'success', 
          title: 'Database Setup Complete', 
          message: result.message 
        });
      } else {
        addToast({ 
          type: 'error', 
          title: 'Database Setup Failed', 
          message: result.message || 'Unknown error occurred'
        });
      }
    } catch (error) {
      addToast({ 
        type: 'error', 
        title: 'Database Setup Error', 
        message: String(error) 
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRepositories();
    await loadGroups();
    setRefreshing(false);
  };

  // Memoized filtered repositories - only recalculate when dependencies change
  const filteredRepos = useMemo(() => {
    let filtered = repos;

    // Filter by search term (debounced)
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchLower) ||
          (repo.description?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    // Filter by language
    if (languageFilter !== 'all') {
      filtered = filtered.filter((repo) => repo.language === languageFilter);
    }

    return filtered;
  }, [repos, debouncedSearchTerm, languageFilter]);

  // Memoize language list calculation
  const languages = useMemo(() => 
    ['all', ...new Set(repos.map((r) => r.language).filter((l): l is string => l !== null))],
    [repos]
  );

  // Memoize grouped repos calculation
  const getGroupedRepos = useMemo(() => {
    const grouped: Record<string, Repository[]> = {};
    const ungrouped: Repository[] = [];

    // Get all repo names that are in groups
    const groupedRepoNames = new Set<string>();
    groups.forEach(group => {
      group.repoNames.forEach(name => groupedRepoNames.add(name));
    });

    // Organize repos by group
    filteredRepos.forEach(repo => {
      const group = groups.find(g => g.repoNames.includes(repo.name));
      if (group) {
        if (!grouped[group.id]) {
          grouped[group.id] = [];
        }
        grouped[group.id].push(repo);
      } else {
        ungrouped.push(repo);
      }
    });

    return { grouped, ungrouped };
  }, [filteredRepos, groups]);

  // Memoize repos grouped by owner
  const getReposByOwner = useMemo(() => {
    const byOwner: Record<string, Repository[]> = {};
    
    filteredRepos.forEach(repo => {
      const owner = repo.full_name.split('/')[0];
      if (!byOwner[owner]) {
        byOwner[owner] = [];
      }
      byOwner[owner].push(repo);
    });
    
    // Sort owners alphabetically
    return Object.keys(byOwner)
      .sort()
      .reduce((acc, owner) => {
        acc[owner] = byOwner[owner];
        return acc;
      }, {} as Record<string, Repository[]>);
  }, [filteredRepos]);

  if (loading) {
    return (
      <div className="projects-loading">
        <Spinner size="lg" text="Loading repositories..." />
      </div>
    );
  }

  return (
    <div className="projects-page animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            {repos.length} repositories found
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search projects..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-wrapper">
          <Filter size={16} className="filter-icon" />
          <select
            className="language-filter"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang === 'all' ? 'All Languages' : lang}
              </option>
            ))}
          </select>
        </div>

        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
            title="Show all repositories"
          >
            <FolderOpen size={16} />
            All
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'grouped' ? 'active' : ''}`}
            onClick={() => setViewMode('grouped')}
            title="Show grouped repositories"
          >
            <Folder size={16} />
            Grouped
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'by-owner' ? 'active' : ''}`}
            onClick={() => setViewMode('by-owner')}
            title="Group by repository owner"
          >
            <FolderGit2 size={16} />
            By Owner
          </button>
        </div>

        <button 
          className="btn btn-secondary"
          onClick={() => setShowGroupsModal(true)}
        >
          <Folder size={16} />
          Manage Groups
        </button>

        <button 
          className={`btn btn-secondary ${refreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Projects Display */}
      {filteredRepos.length > 0 ? (
        viewMode === 'all' ? (
          <div className="projects-grid">
            {filteredRepos.map((repo, index) => (
              <ProjectCard
                key={repo.id}
                repo={repo}
                onSelect={() => navigate(`/projects/${repo.name}`)}
                isInstalled={installedProjects.has(repo.name)}
                onInstall={handleInstall}
                onLinkExisting={handleLinkExisting}
                localPath={projectPaths[repo.name]}
                onOpenInVSCode={handleOpenInVSCode}
                onUninstall={handleUninstall}
                hasRemoteChanges={remoteChanges[repo.name]?.hasChanges}
                behindCount={remoteChanges[repo.name]?.behindCount}
                onPull={handlePull}
                onChangeLocation={handleChangeLocation}
                databaseInfo={databaseStatus[repo.name]}
                onSetupDatabase={handleSetupDatabase}
                style={{ animationDelay: `${index * 0.05}s` }}
              />
            ))}
          </div>
        ) : (
          <div className="grouped-projects-view">
            {(() => {
              const { grouped, ungrouped } = getGroupedRepos;
              return (
                <>
                  {/* Render each group */}
                  {groups.map(group => {
                    const groupRepos = grouped[group.id] || [];
                    if (groupRepos.length === 0) return null;
                    
                    return (
                      <div key={group.id} className="project-group">
                        <div className="group-header">
                          <div className="group-title">
                            <div 
                              className="group-color-indicator" 
                              style={{ backgroundColor: group.color }}
                            />
                            <h2>{group.name}</h2>
                            {group.description && (
                              <span className="group-description">{group.description}</span>
                            )}
                          </div>
                          <span className="group-count">{groupRepos.length} {groupRepos.length === 1 ? 'repo' : 'repos'}</span>
                        </div>
                        <div className="projects-grid">
                          {groupRepos.map((repo, index) => (
                            <ProjectCard
                              key={repo.id}
                              repo={repo}
                              onSelect={() => navigate(`/projects/${repo.name}`)}
                              isInstalled={installedProjects.has(repo.name)}
                              onInstall={handleInstall}
                              onLinkExisting={handleLinkExisting}
                              localPath={projectPaths[repo.name]}
                              onOpenInVSCode={handleOpenInVSCode}
                              onUninstall={handleUninstall}
                              hasRemoteChanges={remoteChanges[repo.name]?.hasChanges}
                              behindCount={remoteChanges[repo.name]?.behindCount}
                              onPull={handlePull}
                              onChangeLocation={handleChangeLocation}
                              databaseInfo={databaseStatus[repo.name]}
                              onSetupDatabase={handleSetupDatabase}
                              style={{ animationDelay: `${index * 0.05}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Ungrouped repos */}
                  {ungrouped.length > 0 && (
                    <div className="project-group ungrouped">
                      <div className="group-header">
                        <div className="group-title">
                          <div className="group-color-indicator" style={{ backgroundColor: '#666' }} />
                          <h2>Ungrouped</h2>
                        </div>
                        <span className="group-count">{ungrouped.length} {ungrouped.length === 1 ? 'repo' : 'repos'}</span>
                      </div>
                      <div className="projects-grid">
                        {ungrouped.map((repo, index) => (
                          <ProjectCard
                            key={repo.id}
                            repo={repo}
                            onSelect={() => navigate(`/projects/${repo.name}`)}
                            isInstalled={installedProjects.has(repo.name)}
                            onInstall={handleInstall}
                            onLinkExisting={handleLinkExisting}
                            localPath={projectPaths[repo.name]}
                            onOpenInVSCode={handleOpenInVSCode}
                            onUninstall={handleUninstall}
                            hasRemoteChanges={remoteChanges[repo.name]?.hasChanges}
                            behindCount={remoteChanges[repo.name]?.behindCount}
                            onPull={handlePull}
                            onChangeLocation={handleChangeLocation}
                            databaseInfo={databaseStatus[repo.name]}
                            onSetupDatabase={handleSetupDatabase}
                            style={{ animationDelay: `${index * 0.05}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )
      ) : (
        <div className="no-results">
          <div className="no-results-icon">
            {searchTerm || languageFilter !== 'all' ? (
              <AlertCircle size={48} />
            ) : (
              <FolderGit2 size={48} />
            )}
          </div>
          <h3>No projects found</h3>
          <p>
            {searchTerm || languageFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No repositories found in your GitHub account'}
          </p>
          {(searchTerm || languageFilter !== 'all') && (
            <button 
              className="btn btn-secondary"
              onClick={() => {
                setSearchTerm('');
                setLanguageFilter('all');
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Project Groups Modal */}
      <ProjectGroupsModal
        isOpen={showGroupsModal}
        onClose={() => setShowGroupsModal(false)}
        repositories={repos}
        onGroupsChanged={() => {
          loadGroups();
        }}
      />
    </div>
  );
}

export default ProjectsPage;
