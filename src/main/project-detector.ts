import { Repository } from './github-service.js';

export interface DetectedScripts {
  dev?: string;
  build?: string;
  start?: string;
  test?: string;
  server?: string;
  client?: string;
  [key: string]: string | undefined;
}

export interface ProjectType {
  type: 'frontend' | 'backend' | 'fullstack' | 'unknown';
  framework?: string;
  language: string;
  packageManager?: string;
  port?: number;
  scripts: DetectedScripts;
}

class ProjectDetector {
  private packageJsonCache: Map<string, any> = new Map();

  async detectProjectType(repo: Repository): Promise<ProjectType> {
    const owner = repo.owner.login;
    const repoName = repo.name;

    try {
      // Try to fetch package.json for Node projects
      const packageJson = await this.fetchPackageJson(owner, repoName);
      if (packageJson) {
        return this.analyzeNodeProject(packageJson, repo.language || 'unknown');
      }

      // Try to detect Python projects
      const hasPython = await this.checkFileExists(owner, repoName, 'requirements.txt');
      if (hasPython) {
        return {
          type: 'backend',
          framework: 'Python',
          language: 'Python',
          packageManager: 'pip',
          port: 5000,
          scripts: { start: 'python main.py' },
        };
      }

      // Default fallback
      return {
        type: 'unknown',
        language: repo.language || 'unknown',
        scripts: {},
      };
    } catch (error) {
      console.error(`Error detecting project type for ${owner}/${repoName}:`, error);
      return {
        type: 'unknown',
        language: repo.language || 'unknown',
        scripts: {},
      };
    }
  }

  private async fetchPackageJson(owner: string, repo: string): Promise<any> {
    const cacheKey = `${owner}/${repo}`;
    if (this.packageJsonCache.has(cacheKey)) {
      return this.packageJsonCache.get(cacheKey);
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
        {
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
          },
        }
      );

      if (!response.ok) return null;

      const data: any = await response.json();
      if (data.encoding === 'base64' && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const parsed = JSON.parse(content);
        this.packageJsonCache.set(cacheKey, parsed);
        return parsed;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private async checkFileExists(owner: string, repo: string, filename: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
        {
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
          },
        }
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private analyzeNodeProject(packageJson: any, _language: string): ProjectType {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const scripts = packageJson.scripts || {};

    // Determine framework
    let framework: string | undefined;
    let type: 'frontend' | 'backend' | 'fullstack' = 'unknown' as any;
    let port: number | undefined;

    if (dependencies.react || dependencies['react-dom']) {
      framework = 'React';
      type = 'frontend';
      port = 3000;
    } else if (dependencies.vue) {
      framework = 'Vue';
      type = 'frontend';
      port = 3000;
    } else if (dependencies['@angular/core']) {
      framework = 'Angular';
      type = 'frontend';
      port = 4200;
    } else if (dependencies.next) {
      framework = 'Next.js';
      type = 'fullstack';
      port = 3000;
    } else if (dependencies.express) {
      framework = 'Express';
      type = 'backend';
      port = 5000;
    } else if (dependencies.fastify) {
      framework = 'Fastify';
      type = 'backend';
      port = 3000;
    } else if (dependencies.hapi) {
      framework = 'Hapi';
      type = 'backend';
      port = 3000;
    } else if (dependencies.prisma || dependencies['@prisma/client']) {
      type = 'backend';
      port = 3000;
    } else {
      type = 'backend';
      port = 3000;
    }

    return {
      type,
      framework,
      language: 'JavaScript/TypeScript',
      packageManager: this.detectPackageManager(packageJson),
      port,
      scripts: {
        dev: scripts.dev,
        build: scripts.build,
        start: scripts.start,
        test: scripts.test,
        ...scripts,
      },
    };
  }

  private detectPackageManager(packageJson: any): string {
    if (packageJson.packageManager?.startsWith('yarn')) return 'yarn';
    if (packageJson.packageManager?.startsWith('pnpm')) return 'pnpm';
    return 'npm';
  }
}

export const projectDetector = new ProjectDetector();
