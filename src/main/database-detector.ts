import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';

export interface DatabaseInfo {
  hasDatabase: boolean;
  type?: 'sqlite' | 'prisma' | 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'unknown';
  isConfigured: boolean;
  isConnected?: boolean;
  isCreated?: boolean;
  configFile?: string;
  connectionString?: string;
  details?: string;
  setupCommand?: string;
  packageManager?: string;
}

class DatabaseDetector {
  /**
   * Detect database configuration for a project
   */
  async detectDatabase(projectPath: string): Promise<DatabaseInfo> {
    try {
      const files = await this.listProjectFiles(projectPath);
      
      // Check for Prisma
      if (files.includes('prisma') || files.includes('schema.prisma')) {
        return await this.detectPrisma(projectPath);
      }
      
      // Check for database files
      const dbFiles = files.filter(f => 
        f.endsWith('.db') || 
        f.endsWith('.sqlite') || 
        f.endsWith('.sqlite3')
      );
      
      if (dbFiles.length > 0) {
        return {
          hasDatabase: true,
          type: 'sqlite',
          isConfigured: true,
          isConnected: true, // If the file exists, it's "connected"
          configFile: dbFiles[0],
          details: `SQLite database: ${dbFiles[0]}`
        };
      }
      
      // Check package.json for database dependencies
      if (files.includes('package.json')) {
        const dbInfo = await this.detectFromPackageJson(projectPath);
        if (dbInfo.hasDatabase) {
          return dbInfo;
        }
      }
      
      // Check for docker-compose with database services
      if (files.includes('docker-compose.yml') || files.includes('docker-compose.yaml')) {
        const dbInfo = await this.detectFromDockerCompose(projectPath);
        if (dbInfo.hasDatabase) {
          return dbInfo;
        }
      }
      
      // Check for .env files with database URLs
      const envFiles = files.filter(f => f.startsWith('.env'));
      for (const envFile of envFiles) {
        const dbInfo = await this.detectFromEnvFile(projectPath, envFile);
        if (dbInfo.hasDatabase) {
          return dbInfo;
        }
      }
      
      // Check for Python database configurations
      if (files.includes('requirements.txt')) {
        const dbInfo = await this.detectFromRequirements(projectPath);
        if (dbInfo.hasDatabase) {
          return dbInfo;
        }
      }
      
      return {
        hasDatabase: false,
        isConfigured: false
      };
    } catch (error) {
      console.error('Error detecting database:', error);
      return {
        hasDatabase: false,
        isConfigured: false
      };
    }
  }

  private async listProjectFiles(projectPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      return entries.map(e => e.name);
    } catch {
      return [];
    }
  }

  private async detectPackageManager(projectPath: string): Promise<string> {
    const files = await this.listProjectFiles(projectPath);
    
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    if (files.includes('bun.lockb')) return 'bun';
    
    // Check package.json for packageManager field
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      if (packageJson.packageManager?.startsWith('pnpm')) return 'pnpm';
      if (packageJson.packageManager?.startsWith('yarn')) return 'yarn';
      if (packageJson.packageManager?.startsWith('bun')) return 'bun';
    } catch {
      // Ignore
    }
    
    return 'npx';
  }

  private async detectPrisma(projectPath: string): Promise<DatabaseInfo> {
    try {
      // Detect package manager first
      const packageManager = await this.detectPackageManager(projectPath);
      
      // Check prisma directory
      let schemaPath = path.join(projectPath, 'prisma', 'schema.prisma');
      try {
        await fs.access(schemaPath);
      } catch {
        schemaPath = path.join(projectPath, 'schema.prisma');
        try {
          await fs.access(schemaPath);
        } catch {
          return {
            hasDatabase: true,
            type: 'prisma',
            isConfigured: false,
            isCreated: false,
            details: 'Prisma detected but schema not found',
            setupCommand: `${packageManager} prisma init`,
            packageManager
          };
        }
      }

      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      
      // Detect provider from schema
      let dbType: DatabaseInfo['type'] = 'unknown';
      if (schemaContent.includes('provider = "postgresql"') || schemaContent.includes('provider = "postgres"')) {
        dbType = 'postgres';
      } else if (schemaContent.includes('provider = "mysql"')) {
        dbType = 'mysql';
      } else if (schemaContent.includes('provider = "sqlite"')) {
        dbType = 'sqlite';
      } else if (schemaContent.includes('provider = "mongodb"')) {
        dbType = 'mongodb';
      }
      
      // Check if database file exists (for SQLite) or if migrations exist
      let isCreated = false;
      let isConnected = false;
      
      // Check for migrations folder
      const migrationsPath = path.join(projectPath, 'prisma', 'migrations');
      try {
        const migrations = await fs.readdir(migrationsPath);
        isCreated = migrations.length > 0;
      } catch {
        isCreated = false;
      }
      
      if (dbType === 'sqlite') {
        const devDbPath = path.join(projectPath, 'prisma', 'dev.db');
        try {
          await fs.access(devDbPath);
          isConnected = true;
          isCreated = true;
        } catch {
          // Check for other common sqlite db names
          const prismaDir = path.join(projectPath, 'prisma');
          try {
            const prismaFiles = await fs.readdir(prismaDir);
            const hasDbFile = prismaFiles.some(f => f.endsWith('.db'));
            isConnected = hasDbFile;
            isCreated = hasDbFile || isCreated;
          } catch {
            isConnected = false;
          }
        }
      } else {
        // For other databases, check if there's an .env file with DATABASE_URL
        isConnected = await this.checkEnvForDatabaseUrl(projectPath);
      }
      
      // Determine the appropriate setup command
      let setupCommand = `${packageManager} prisma db push`;
      if (!isCreated) {
        setupCommand = `${packageManager} prisma migrate dev --name init`;
      } else if (!isConnected && dbType === 'sqlite') {
        setupCommand = `${packageManager} prisma db push`;
      }
      
      return {
        hasDatabase: true,
        type: dbType,
        isConfigured: true,
        isCreated,
        isConnected,
        configFile: 'prisma/schema.prisma',
        details: `Prisma with ${dbType} provider${isCreated ? ' (migrated)' : ' (not migrated)'}`,
        setupCommand,
        packageManager
      };
    } catch (error) {
      return {
        hasDatabase: true,
        type: 'prisma',
        isConfigured: false,
        isCreated: false,
        details: 'Prisma detected but could not read schema'
      };
    }
  }

  private async detectFromPackageJson(projectPath: string): Promise<DatabaseInfo> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for various database packages
      if (deps['@prisma/client'] || deps.prisma) {
        return await this.detectPrisma(projectPath);
      }
      
      if (deps.pg || deps['pg-promise'] || deps.postgres) {
        return {
          hasDatabase: true,
          type: 'postgres',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'PostgreSQL client detected'
        };
      }
      
      if (deps.mysql || deps.mysql2) {
        return {
          hasDatabase: true,
          type: 'mysql',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'MySQL client detected'
        };
      }
      
      if (deps.mongodb || deps.mongoose) {
        return {
          hasDatabase: true,
          type: 'mongodb',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath, 'MONGODB_URI'),
          details: deps.mongoose ? 'Mongoose (MongoDB) detected' : 'MongoDB client detected'
        };
      }
      
      if (deps.sqlite3 || deps['better-sqlite3']) {
        return {
          hasDatabase: true,
          type: 'sqlite',
          isConfigured: true,
          isConnected: await this.checkForSqliteFile(projectPath),
          details: 'SQLite detected'
        };
      }
      
      if (deps.redis || deps.ioredis) {
        return {
          hasDatabase: true,
          type: 'redis',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath, 'REDIS_URL'),
          details: 'Redis client detected'
        };
      }
      
      if (deps.typeorm) {
        return {
          hasDatabase: true,
          type: 'unknown',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'TypeORM detected'
        };
      }
      
      if (deps.sequelize) {
        return {
          hasDatabase: true,
          type: 'unknown',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'Sequelize detected'
        };
      }
      
      if (deps.knex) {
        return {
          hasDatabase: true,
          type: 'unknown',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'Knex.js detected'
        };
      }
      
      if (deps.drizzle || deps['drizzle-orm']) {
        return {
          hasDatabase: true,
          type: 'unknown',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'Drizzle ORM detected'
        };
      }
      
      return { hasDatabase: false, isConfigured: false };
    } catch {
      return { hasDatabase: false, isConfigured: false };
    }
  }

  private async detectFromDockerCompose(projectPath: string): Promise<DatabaseInfo> {
    try {
      let composePath = path.join(projectPath, 'docker-compose.yml');
      try {
        await fs.access(composePath);
      } catch {
        composePath = path.join(projectPath, 'docker-compose.yaml');
      }
      
      const content = await fs.readFile(composePath, 'utf-8');
      const contentLower = content.toLowerCase();
      
      if (contentLower.includes('postgres') || contentLower.includes('postgresql')) {
        return {
          hasDatabase: true,
          type: 'postgres',
          isConfigured: true,
          isConnected: false, // Docker services need to be started
          configFile: 'docker-compose.yml',
          details: 'PostgreSQL in Docker Compose'
        };
      }
      
      if (contentLower.includes('mysql') || contentLower.includes('mariadb')) {
        return {
          hasDatabase: true,
          type: 'mysql',
          isConfigured: true,
          isConnected: false,
          configFile: 'docker-compose.yml',
          details: 'MySQL/MariaDB in Docker Compose'
        };
      }
      
      if (contentLower.includes('mongo')) {
        return {
          hasDatabase: true,
          type: 'mongodb',
          isConfigured: true,
          isConnected: false,
          configFile: 'docker-compose.yml',
          details: 'MongoDB in Docker Compose'
        };
      }
      
      if (contentLower.includes('redis')) {
        return {
          hasDatabase: true,
          type: 'redis',
          isConfigured: true,
          isConnected: false,
          configFile: 'docker-compose.yml',
          details: 'Redis in Docker Compose'
        };
      }
      
      return { hasDatabase: false, isConfigured: false };
    } catch {
      return { hasDatabase: false, isConfigured: false };
    }
  }

  private async detectFromEnvFile(projectPath: string, envFile: string): Promise<DatabaseInfo> {
    try {
      const envPath = path.join(projectPath, envFile);
      const content = await fs.readFile(envPath, 'utf-8');
      const contentLower = content.toLowerCase();
      
      if (content.includes('DATABASE_URL') || content.includes('DB_CONNECTION')) {
        let dbType: DatabaseInfo['type'] = 'unknown';
        
        if (contentLower.includes('postgresql') || contentLower.includes('postgres://')) {
          dbType = 'postgres';
        } else if (contentLower.includes('mysql://')) {
          dbType = 'mysql';
        } else if (contentLower.includes('mongodb://') || contentLower.includes('mongodb+srv://')) {
          dbType = 'mongodb';
        } else if (contentLower.includes('file:') || contentLower.includes('.db') || contentLower.includes('.sqlite')) {
          dbType = 'sqlite';
        }
        
        // Check if the URL has actual values (not just placeholder)
        const hasRealValue = !content.includes('your_') && 
                           !content.includes('YOUR_') && 
                           !content.includes('<') && 
                           !content.includes('>') &&
                           !content.includes('xxx');
        
        return {
          hasDatabase: true,
          type: dbType,
          isConfigured: true,
          isConnected: hasRealValue,
          configFile: envFile,
          details: `Database configured in ${envFile}`
        };
      }
      
      return { hasDatabase: false, isConfigured: false };
    } catch {
      return { hasDatabase: false, isConfigured: false };
    }
  }

  private async detectFromRequirements(projectPath: string): Promise<DatabaseInfo> {
    try {
      const reqPath = path.join(projectPath, 'requirements.txt');
      const content = await fs.readFile(reqPath, 'utf-8');
      const contentLower = content.toLowerCase();
      
      if (contentLower.includes('psycopg2') || contentLower.includes('asyncpg')) {
        return {
          hasDatabase: true,
          type: 'postgres',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'PostgreSQL client (Python)'
        };
      }
      
      if (contentLower.includes('mysqlclient') || contentLower.includes('pymysql')) {
        return {
          hasDatabase: true,
          type: 'mysql',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'MySQL client (Python)'
        };
      }
      
      if (contentLower.includes('pymongo')) {
        return {
          hasDatabase: true,
          type: 'mongodb',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath, 'MONGODB_URI'),
          details: 'MongoDB client (Python)'
        };
      }
      
      if (contentLower.includes('sqlalchemy')) {
        return {
          hasDatabase: true,
          type: 'unknown',
          isConfigured: true,
          isConnected: await this.checkEnvForDatabaseUrl(projectPath),
          details: 'SQLAlchemy detected'
        };
      }
      
      return { hasDatabase: false, isConfigured: false };
    } catch {
      return { hasDatabase: false, isConfigured: false };
    }
  }

  private async checkEnvForDatabaseUrl(projectPath: string, envVar: string = 'DATABASE_URL'): Promise<boolean> {
    try {
      const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
      
      for (const envFile of envFiles) {
        try {
          const envPath = path.join(projectPath, envFile);
          const content = await fs.readFile(envPath, 'utf-8');
          
          if (content.includes(`${envVar}=`)) {
            const lines = content.split('\n');
            const dbLine = lines.find(l => l.startsWith(`${envVar}=`));
            if (dbLine) {
              const value = dbLine.split('=')[1]?.trim();
              // Check if it has a real value
              if (value && 
                  value.length > 10 && 
                  !value.includes('your_') && 
                  !value.includes('YOUR_') &&
                  !value.includes('<') &&
                  !value.includes('xxx')) {
                return true;
              }
            }
          }
        } catch {
          // File doesn't exist, continue
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private async checkForSqliteFile(projectPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true, recursive: true });
      return entries.some(e => 
        !e.isDirectory() && 
        (e.name.endsWith('.db') || e.name.endsWith('.sqlite') || e.name.endsWith('.sqlite3'))
      );
    } catch {
      return false;
    }
  }

  /**
   * Setup/generate the database for a project
   */
  async setupDatabase(projectPath: string, onProgress?: (message: string) => void): Promise<{ success: boolean; message: string }> {
    try {
      const dbInfo = await this.detectDatabase(projectPath);
      
      if (!dbInfo.hasDatabase) {
        return { success: false, message: 'No database configuration detected' };
      }
      
      if (!dbInfo.setupCommand) {
        return { success: false, message: 'No setup command available for this database type' };
      }
      
      onProgress?.(`Running: ${dbInfo.setupCommand}`);
      
      // Parse the command
      const parts = dbInfo.setupCommand.split(' ');
      const command = parts[0];
      const args = parts.slice(1);
      
      return new Promise((resolve) => {
        const child = spawn(command, args, {
          cwd: projectPath,
          shell: true,
          env: { ...process.env, FORCE_COLOR: '0' }
        });
        
        let output = '';
        let errorOutput = '';
        
        child.stdout?.on('data', (data) => {
          const text = data.toString();
          output += text;
          onProgress?.(text);
        });
        
        child.stderr?.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          onProgress?.(text);
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, message: 'Database setup completed successfully' });
          } else {
            resolve({ 
              success: false, 
              message: errorOutput || output || `Setup failed with exit code ${code}` 
            });
          }
        });
        
        child.on('error', (error) => {
          resolve({ success: false, message: error.message });
        });
      });
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }
}

export const databaseDetector = new DatabaseDetector();
