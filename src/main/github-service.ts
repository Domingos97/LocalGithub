import { Octokit } from '@octokit/rest';

// dotenv is loaded in index.ts before this module is imported

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
}

class GitHubService {
  private octokit: Octokit;
  private token: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    if (!this.token) {
      throw new Error('GITHUB_TOKEN environment variable is not set');
    }
    this.octokit = new Octokit({ auth: this.token });
  }

  async validateToken(): Promise<boolean> {
    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      return !!response.data;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async getCurrentUser(): Promise<GitHubUser> {
    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      return {
        id: response.data.id,
        login: response.data.login,
        avatar_url: response.data.avatar_url,
        name: response.data.name,
        bio: response.data.bio,
        public_repos: response.data.public_repos,
      };
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      throw error;
    }
  }

  async getUserRepositories(page: number = 1, per_page: number = 100): Promise<Repository[]> {
    try {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        page,
        per_page,
        sort: 'updated',
        direction: 'desc',
      });

      return response.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        updated_at: repo.updated_at,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
      }));
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      throw error;
    }
  }

  async getAllUserRepositories(): Promise<Repository[]> {
    const repos: Repository[] = [];
    let page = 1;
    const per_page = 100;

    try {
      while (true) {
        const pageRepos = await this.getUserRepositories(page, per_page);
        if (pageRepos.length === 0) break;
        repos.push(...pageRepos);
        if (pageRepos.length < per_page) break;
        page++;
      }
      return repos;
    } catch (error) {
      console.error('Failed to fetch all repositories:', error);
      throw error;
    }
  }

  async getRepository(repoName: string): Promise<any> {
    try {
      // First get the current user to know the owner
      const user = await this.getCurrentUser();
      const response = await this.octokit.rest.repos.get({
        owner: user.login,
        repo: repoName,
      });

      const repo = response.data;
      return {
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        updated_at: repo.updated_at,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        private: repo.private,
        size: repo.size,
        open_issues_count: repo.open_issues_count,
      };
    } catch (error) {
      console.error(`Failed to fetch repository ${repoName}:`, error);
      throw error;
    }
  }

  async getRepositoryContent(owner: string, repo: string, path: string = ''): Promise<any> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch content from ${owner}/${repo}/${path}:`, error);
      return null;
    }
  }

  async getRawFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(response.data)) {
        return null;
      }

      if ('content' in response.data && response.data.encoding === 'base64') {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

// Lazy initialization to ensure dotenv is loaded first
let _githubService: GitHubService | null = null;

export const getGitHubService = (): GitHubService => {
  if (!_githubService) {
    _githubService = new GitHubService();
  }
  return _githubService;
};

// For backward compatibility - use getter
export const githubService = {
  get instance() {
    return getGitHubService();
  },
  validateToken: () => getGitHubService().validateToken(),
  getCurrentUser: () => getGitHubService().getCurrentUser(),
  getAllUserRepositories: () => getGitHubService().getAllUserRepositories(),
  getRepository: (repoName: string) => getGitHubService().getRepository(repoName),
  getRepositoryContent: (owner: string, repo: string, path: string) => getGitHubService().getRepositoryContent(owner, repo, path),
  getRawFileContent: (owner: string, repo: string, path: string) => getGitHubService().getRawFileContent(owner, repo, path),
};
