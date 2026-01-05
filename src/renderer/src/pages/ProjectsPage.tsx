import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, FolderGit2, AlertCircle } from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
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

function ProjectsPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [installedProjects, setInstalledProjects] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    filterRepositories();
  }, [repos, searchTerm, languageFilter]);

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
    for (const repo of repositories) {
      try {
        const result = await (window as any).electronAPI.project.isInstalled(repo.name);
        if (result.success && result.data.installed) {
          installed.add(repo.name);
        }
      } catch (error) {
        // Ignore errors for individual checks
      }
    }
    setInstalledProjects(installed);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRepositories();
    setRefreshing(false);
  };

  const filterRepositories = () => {
    let filtered = repos;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (repo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
      );
    }

    // Filter by language
    if (languageFilter !== 'all') {
      filtered = filtered.filter((repo) => repo.language === languageFilter);
    }

    setFilteredRepos(filtered);
  };

  const languages = ['all', ...new Set(repos.map((r) => r.language).filter((l): l is string => l !== null))];

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

        <button 
          className={`btn btn-secondary ${refreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Projects Grid */}
      {filteredRepos.length > 0 ? (
        <div className="projects-grid">
          {filteredRepos.map((repo, index) => (
            <ProjectCard
              key={repo.id}
              repo={repo}
              onSelect={() => navigate(`/projects/${repo.name}`)}
              isInstalled={installedProjects.has(repo.name)}
              onInstall={handleInstall}
              style={{ animationDelay: `${index * 0.05}s` }}
            />
          ))}
        </div>
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
    </div>
  );
}

export default ProjectsPage;
