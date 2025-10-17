# Support Portal

A simple Node.js + Express support ticket system that uses SQLite and Socket.IO for real-time updates. The project includes static frontend files under `public/` and a small API in `server.js`.

Quick start (local):

1. Install dependencies:

   npm install

2. Start the server:

   npm start

3. Open the portal in your browser:

   http://localhost:3000

Notes for hosting:

- The app is a Node server and must be hosted on a platform that supports Node.js (Render, Railway, Heroku, Fly, or a Docker host).
- The SQLite file path can be overridden with the `DB_PATH` environment variable.
- A `Dockerfile` and `Procfile` are included for containerized or Heroku-style deployments.

Environment variables:

- PORT: port to listen on (default 3000)
- DB_PATH: path to the SQLite DB file (default `./tickets.db`)

Files of interest:

- `server.js` — main server and API
- `public/` — static frontend pages
- `package.json` — scripts and dependencies
- `Dockerfile`, `.dockerignore`, `Procfile` — hosting helpers

Troubleshooting:

- If the app cannot open the DB, ensure the process has write permissions to the folder and the `DB_PATH` is valid.
- For production, consider using a hosted DB (Postgres, MySQL) instead of SQLite for concurrency and durability.
