
# ReviewLens AI Backend

ReviewLens AI Backend built with **Node.js** and **Express.js**.

This README covers the prerequisites, installation, environment configuration, and instructions for running the application locally.

## Tech Stack

- Node.js
- Express.js
- JavaScript
- npm

## Prerequisites

Make sure the following tools are installed:

- [Node.js](https://nodejs.org/) (Version 20 or higher recommended)
- npm (included with Node.js)
- Git

Verify your installations:

```bash
node -v
npm -v
git --version
```

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
```

Navigate into the project directory:

```bash
cd <project-directory>
```

### 2. Install Dependencies

Install the required dependencies:

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root.

```bash
touch .env
```

Add the required environment variables:

```env
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

Additional environment variables may be required depending on the application configuration, such as database credentials or authentication secrets.

Refer to `.env.example` for the complete list of required variables, if available.

**Note:** Never commit your `.env` file or expose sensitive credentials.

### 4. Run the Application

Start the development server:

```bash
npm run dev
```

If a development script is not configured, start the application using:

```bash
npm start
```

The backend should now be running at:

```text
http://localhost:3000
```

### 5. Verify the Application

If the application has a health-check endpoint, visit:

```text
http://localhost:3000/health
```

You can also test API endpoints using Postman or Insomnia.

## Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the development server |
| `npm start` | Start the application |
| `npm test` | Run tests |

Available scripts depend on the project's `package.json`.

## Project Structure

```text
backend/
├── src/
│   ├── config/             # Application configuration
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Express middleware
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── utils/              # Helper functions
│   ├── app.js              # Express application
│   └── server.js           # Server entry point
├── package.json
├── package-lock.json
└── README.md
```

Note: The actual project structure may differ.

## Troubleshooting

### Port Already in Use

Change the `PORT` value in your `.env` file.

### Dependencies Not Installing

Try reinstalling dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables Not Loading

- Verify that the `.env` file exists in the project root.
- Ensure `dotenv` is installed and configured.
- Restart the development server after changing environment variables.

### Application Not Starting

- Verify your Node.js and npm versions.
- Ensure dependencies are installed.
- Check terminal output for errors.
- Verify the environment configuration.

## Additional Resources

- [Node.js Documentation](https://nodejs.org/docs/latest/api/)
- [Express.js Documentation](https://expressjs.com/)
- [npm Documentation](https://docs.npmjs.com/)

---
