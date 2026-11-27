# Tire inventory

A phone-friendly web app for scanning tire QR labels and recording stock: count, intake, and removal.

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

Open http://localhost:5173

Database and session settings belong in `.env`. That file stays on your machine and is not in this repository.

## Start

Node 20 or newer.

```bash
npm start
```

The server listens on the `PORT` environment variable.
