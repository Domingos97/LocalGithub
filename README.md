# LocalGitHub Manager

A local desktop application that automatically connects to your GitHub account and allows you to easily manage, install, and run all your projects.

## Features

- 🔗 Auto-connect to GitHub account using personal access token
- 📦 Browse all your repositories
- 🔍 Auto-detect project types (Frontend, Backend, Full-Stack)
- 📥 One-click installation with dependency management
- ▶️ Run multiple projects simultaneously
- 💻 Integrated terminal output viewer
- ⚙️ Port conflict resolution and management

## Prerequisites

- Node.js 16+ 
- npm or yarn
- GitHub Personal Access Token

## Setup

1. Clone the repository:
```bash
git clone <repo-url>
cd LocalGitHub
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Add your GitHub token to `.env`:
```
GITHUB_TOKEN=your_personal_access_token_here
```

## Development

Start the development server:
```bash
npm run dev
```

This will start both the Electron main process and the React dev server.

## Building

Build for production:
```bash
npm run build
```

Package for distribution:
```bash
npm run package
```

## Project Structure

```
LocalGitHub/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── github-service.ts # GitHub API integration
│   │   ├── project-detector.ts # Project type detection
│   │   ├── process-manager.ts  # Process management
│   │   ├── git-operations.ts   # Git clone/pull operations
│   │   ├── installer.ts        # Dependency installation
│   │   └── ipc-handlers.ts     # IPC communication
│   │
│   └── renderer/            # React frontend
│       ├── src/
│       │   ├── App.tsx
│       │   ├── pages/       # Page components
│       │   ├── components/  # Reusable components
│       │   └── styles/      # CSS styles
│       └── index.html
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.json
```

## Supported Project Types

### Frontend
- React
- Vue
- Angular
- Next.js
- Vite
- Static HTML/CSS/JS

### Backend
- Express.js
- Flask
- Django
- FastAPI
- Node.js
- Go
- Rust

### Full-Stack
- Monorepos
- Docker-based applications

## GitHub Token Permissions

Your personal access token needs the following scopes:
- `repo` - Full control of private repositories
- `public_repo` - Access to public repositories

## Configuration

User settings are stored in `~/.localgithub/config.json`:

```json
{
  "projects_directory": "~/.localgithub/projects",
  "auto_refresh_interval": 300000,
  "auto_start_on_launch": false,
  "max_concurrent_processes": 5,
  "enable_auto_update": true,
  "theme": "dark",
  "default_editor": "vscode"
}
```

## License

MIT

## Support

For issues and feature requests, please use the GitHub issue tracker.
