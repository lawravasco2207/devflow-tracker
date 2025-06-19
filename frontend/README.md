# Frontend (React)

This is the React frontend for the project.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm start
   ```

## Build

To create a production build:
```bash
npm run build
```

## Lint & Type Check

- Lint: `npm run lint` (if configured)
- Type check: `tsc --noEmit`

## Service Worker

This app supports PWA features via a service worker. See `src/serviceWorkerRegistration.ts` for details.

## Environment Variables

- `REACT_APP_API_URL`: Set this in a `.env` file to override the backend API URL.

## Folder Structure

- `src/` - Main source code
- `public/` - Static assets 