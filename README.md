# Hedge Edge

Hedge Edge is a prop trading hedge account management platform built with modern web technologies.

## Technologies

This project is built with:

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **Supabase** - Backend as a service

## Getting Started

### Prerequisites

- Node.js 18+ and npm installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd hedge-edge

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:8080`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Features

- **Account Management** - Track Evaluation, Funded, and Hedge accounts
- **Real-time Dashboard** - Monitor all your trading accounts in one place
- **Account Credentials** - Securely store platform login details
- **Local Storage Fallback** - Works offline with localStorage demo mode
- **Responsive Design** - Works on desktop and mobile devices

## Project Structure

```
src/
├── components/        # React components
│   ├── dashboard/    # Dashboard-specific components
│   └── ui/           # Reusable UI components
├── contexts/         # React contexts (Auth, etc.)
├── hooks/            # Custom React hooks
├── pages/            # Page components
└── lib/              # Utility functions
```

## Environment Variables

Create a `.env` file in the root directory:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

See `.env.example` for reference.

## License

MIT
