# Hedge-Edge Desktop App

A professional desktop trading application for managing multiple MT5 and cTrader accounts with hedging capabilities. Built with Electron, React, and Python.

![Hedge-Edge](Hedge-Edge-Front-end/public/Hedge%20Edge.jpg)

## Features

- **Multi-Account Management** – Connect and monitor multiple MT5/cTrader trading accounts
- **Real-Time Data Feeds** – Live account balances, equity, and position updates
- **Hedge Mapping** – Visual representation of hedged positions across accounts
- **Trade Copier** – Copy trades between linked accounts (coming soon)
- **Local-First Architecture** – Your credentials stay on your machine
- **Optional Cloud Sync** – Supabase integration for cross-device access

## Project Structure

```
Hedge-Edge-App/
├── Hedge-Edge-Front-end/     # Electron + React desktop application
│   ├── electron/             # Main process (IPC, agent supervisor)
│   ├── src/                  # React UI components
│   ├── build/                # App icons and resources
│   └── package.json
├── backend/                  # Python MT5 API server
│   ├── mt5_api_server.py     # Local Flask server for MT5 connection
│   ├── requirements.txt
│   └── vps-deployment/       # VPS deployment scripts
├── mt5-cluster/              # Docker orchestration (optional)
└── Hedge-Edge-app.code-workspace
```

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+ (for MT5 integration)
- **MetaTrader 5** terminal installed (Windows only for MT5)

### 1. Install Frontend Dependencies

```bash
cd Hedge-Edge-Front-end
npm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.desktop.example .env

# Edit .env with your Supabase credentials (optional for cloud sync)
```

### 3. Set Up Python MT5 Agent

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

### 4. Run in Development Mode

**Terminal 1 – Start Vite dev server:**
```bash
cd Hedge-Edge-Front-end
npm run vite:dev
```

**Terminal 2 – Start Electron:**
```bash
cd Hedge-Edge-Front-end
npm run electron:dev
```

**Terminal 3 – Start MT5 Agent (optional):**
```bash
cd backend
# Create .env.mt5 with your MT5 credentials first
python mt5_api_server.py
```

## Building for Production

### Windows Installer

```bash
cd Hedge-Edge-Front-end
npm run electron:build:win
```

Output: `dist/Hedge-Edge-Setup-{version}.exe`

### macOS Application

```bash
cd Hedge-Edge-Front-end
npm run electron:build:mac
```

Output: `dist/Hedge-Edge-{version}.dmg`

## MT5 Agent Configuration

Create `backend/.env.mt5`:

```env
MT5_LOGIN=your_account_number
MT5_PASSWORD=your_password
MT5_SERVER=your_broker_server
```

The MT5 agent runs locally on port 5101 and provides:
- Account info endpoint: `GET /account`
- Positions endpoint: `GET /positions`
- Health check: `GET /health`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ Agent Supervisor│  │      IPC Bridge (preload)    │  │
│  └────────┬────────┘  └──────────────────────────────┘  │
│           │                        ↕                    │
│           ↓                                             │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  MT5 Python     │  │     React UI (Renderer)      │  │
│  │  Agent (5101)   │  │   - Dashboard                │  │
│  └────────┬────────┘  │   - Account Management       │  │
│           │           │   - Hedge Map Visualization  │  │
│           ↓           └──────────────────────────────┘  │
│  ┌─────────────────┐                                    │
│  │  MetaTrader 5   │                                    │
│  │    Terminal     │                                    │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Desktop Shell | Electron 33 |
| UI Framework | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Build Tool | Vite 5 |
| MT5 Bridge | Python + MetaTrader5 library |
| Cloud Sync | Supabase (optional) |
| Packaging | electron-builder |

## Development

### Available Scripts

```bash
# Frontend development
npm run vite:dev          # Start Vite dev server (port 8081)
npm run electron:dev      # Start Electron in dev mode
npm run electron:compile  # Compile TypeScript for Electron

# Production builds
npm run electron:build:win   # Build Windows installer
npm run electron:build:mac   # Build macOS app
```

### Project Conventions

- Electron main process code in `electron/`
- React components in `src/components/`
- Trading hooks in `src/hooks/`
- IPC handlers registered in `electron/preload.ts`

## Security

- **Credentials are stored locally** – MT5 passwords never leave your machine
- **No telemetry** – The app doesn't phone home
- **Optional cloud sync** – Supabase is opt-in for cross-device features
- **Encrypted storage** – Sensitive data encrypted via Electron safeStorage

## Troubleshooting

### Electron window doesn't appear
- Ensure Vite is running on port 8081 before starting Electron
- Check `VITE_DEV_SERVER_URL` environment variable

### MT5 connection fails
- Verify MetaTrader 5 terminal is installed and running
- Check credentials in `backend/.env.mt5`
- Ensure the MT5 agent is running on port 5101

### Build errors
- Delete `node_modules` and `package-lock.json`, then `npm install`
- Ensure you're using Node.js 18+

## License

Private repository – All rights reserved.

## Contributing

This is a private project. For questions or feature requests, contact the repository owner.
