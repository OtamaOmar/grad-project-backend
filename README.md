# grad-project-backend
Backend for an AI-powered university course offering and academic planning system, supporting course planning, prerequisite management, course offerings, advisor/coordinator workflows, and LLM-based recommendations.

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
