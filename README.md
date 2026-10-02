# Grad Project Backend

Backend for an AI-powered university course offering and academic planning system.

The backend supports:

* Course planning and academic progress
* Course prerequisites and dependency management
* Course offerings and availability
* Advisor and coordinator workflows
* LLM-powered recommendations and academic assistance

## Tech Stack

### Main Backend

* **Node.js**
* **Express.js**
* **JavaScript (ES Modules)**

### AI / LLM Service

* **Python**
* **FastAPI**
* **LLM-based services and recommendations**

### Development Tools

* **ESLint** — code quality and linting
* **Prettier** — code formatting
* **Nodemon** — development server
* **python venv** — isolated Python environment

## Project Structure

```text
grad-project-backend/
├── ai/                       # Python AI / LLM service
│   └── requirements.txt
│
├── src/                      # Node.js backend
│   ├── config/               # Application configuration
│   ├── controllers/          # Request handlers
│   ├── middleware/           # Express middleware
│   ├── routes/               # API routes
│   ├── services/             # Business logic and integrations
│   └── utils/                # Shared utilities
│
├── tests/                    # Backend tests
│
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Setup

Clone the repository and run the following commands:

```bash
cd ~/github/grad/grad-project-backend && \
npm install && \
npm install express cors dotenv && \
npm install -D eslint @eslint/js globals nodemon prettier && \
mkdir -p src/{config,controllers,middleware,routes,services,utils} tests ai && \
python3 -m venv .venv && \
source .venv/bin/activate && \
python -m pip install --upgrade pip && \
python -m pip install -r ai/requirements.txt && \
npm pkg set main="src/server.js" && \
npm pkg set private=true && \
npm pkg delete scripts.test
```

This setup:

1. Installs Node.js dependencies.
2. Installs development tools.
3. Creates the backend directory structure.
4. Creates the Python virtual environment.
5. Installs Python dependencies.
6. Configures the Node.js project.

## Development

Start the Node.js backend in development mode:

```bash
npm run dev
```

Start the backend normally:

```bash
npm start
```

Run ESLint:

```bash
npm run lint
```

Format the project:

```bash
npm run format
```

Check formatting without modifying files:

```bash
npm run format:check
```

## Python Environment

Activate the Python virtual environment:

```bash
source .venv/bin/activate
```

Install or update Python dependencies:

```bash
pip install -r ai/requirements.txt
```

Deactivate the virtual environment when finished:

```bash
deactivate
```

## Architecture

The backend is separated into two main parts:

```text
                    ┌─────────────────────┐
                    │      Frontend       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Node.js Backend   │
                    │      Express.js     │
                    └──────────┬──────────┘
                               │
                     HTTP / Internal API
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Python AI/LLM     │
                    │       FastAPI       │
                    └─────────────────────┘
```

The **Node.js backend** handles the main application API, business logic, authentication, course management, and communication with other system components.

The **Python service** is responsible for AI/LLM-related functionality.

## Environment Variables

Environment-specific configuration should be stored in `.env` files and should **not** be committed to Git.

Example:

```env
PORT=3000
```

Never commit secrets, API keys, passwords, or other sensitive credentials.

## Git Workflow

The repository uses feature and test branches for development.

Recommended workflow:

```text
main
 │
 ├── feature/*
 │
 └── test/*
```

Changes sho
