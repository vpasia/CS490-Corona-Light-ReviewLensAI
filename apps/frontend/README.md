
# ReviewLens AI Frontend

Welcome to the ReviewLens AI frontend repository! This project is built using **React**, **JavaScript**, and **Vite**.

This documentation provides instructions for setting up the development environment, running the application locally, and understanding the project structure

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Build and Deployment](#build-and-deployment)
- [Troubleshooting](#troubleshooting)

## Tech Stack

| Technology | Description |
|---|---|
| React | Frontend UI library |
| JavaScript (ES6+) | Application programming language |
| Vite | Frontend build tool and development server |
| HTML5 | Application markup |
| CSS3 | Styling |
| npm | Package manager |

## Prerequisites

Before getting started, make sure you have the following installed:

- **Node.js** – Version 20 or higher recommended.
- **npm** – Comes bundled with Node.js.
- **Git** – For version control.
- **Code Editor** – Visual Studio Code is recommended.

Verify your installations:

```bash
node -v
npm -v
git --version
```

## Getting Started

Follow these steps to set up the project locally.

### 1. Clone the Repository

```bash
git clone <repository-url>
```

Navigate into the project directory:

```bash
cd <project-directory>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root directory.

```bash
touch .env
```

Add the required environment variables:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

**Important:**
- All environment variables exposed to frontend code must start with `VITE_`.
- Access variables using `import.meta.env`.
- Never store sensitive credentials, private API keys, or secrets in frontend environment variables.

Example:

```javascript
const API_URL = import.meta.env.VITE_API_BASE_URL;
```

### 4. Start the Development Server

```bash
npm run dev
```

Vite will start the development server.

By default, the application will be available at:

```text
http://localhost:5173
```

Open the URL in your browser to access the application.

## Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the application for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run code linting (if configured) |
| `npm run test` | Run tests |

Run a script using:

```bash
npm run <script-name>
```

Note: Available scripts depend on the configuration in `package.json`.

## Project Structure

The project follows a modular structure to keep components, pages, assets, and application logic organized.

```text
frontend/
├── public/                 # Static public assets
├── src/
│   ├── assets/             # Images, icons, fonts, etc.
│   ├── components/         # Reusable UI components
│   ├── pages/              # Application pages/views
│   ├── layouts/            # Shared page layouts
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API calls and external services
│   ├── utils/              # Helper functions
│   ├── styles/             # Global styles and CSS
│   ├── App.jsx             # Main application component
│   └── main.jsx            # Application entry point
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── package-lock.json       # Dependency lock file
└── vite.config.js          # Vite configuration
```

### Git Workflow

Use descriptive branch names:

```text
feature/user-authentication
bugfix/login-validation
hotfix/api-error
```

Recommended commit message format:

```text
feat: add user authentication
fix: resolve login validation issue
refactor: improve component structure
docs: update frontend documentation
style: update button styling
```

Before submitting changes:

1. Verify the application runs locally.
2. Check for console errors.
3. Test the affected functionality.
4. Ensure there are no unintended changes.
5. Create a pull request for review.

## Build and Deployment

### Create a Production Build

```bash
npm run build
```

Vite generates an optimized production build inside the `dist/` directory.

### Preview the Production Build

```bash
npm run preview
```

The preview server will provide a local URL to access the built application.

### Deployment

The generated `dist/` directory contains static assets that can be deployed to platforms such as:

- Vercel
- Netlify
- AWS S3 + CloudFront
- Nginx
- Firebase Hosting
- Other static hosting providers

Make sure the correct environment variables are configured for the target environment.

## Troubleshooting

### Port Already in Use

If the default Vite port is unavailable, start the server on another port:

```bash
npm run dev -- --port 3001
```

### Dependency Installation Issues

Try removing installed dependencies and reinstalling:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables Not Updating

- Verify that environment variables use the `VITE_` prefix.
- Check that the `.env` file is located in the project root.
- Restart the Vite development server after modifying environment variables.

### Application Not Starting

Try the following:

1. Verify your Node.js and npm versions.
2. Ensure dependencies are installed.
3. Check terminal output for errors.
4. Verify the `package.json` scripts.
5. Check the Vite configuration.

## Additional Resources

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)
- [JavaScript Documentation (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [npm Documentation](https://docs.npmjs.com/)

---
