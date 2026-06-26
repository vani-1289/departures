# Departures — Last-Minute Life Saver

An AI productivity companion that frames deadlines like a flight departures board: every task has a boarding window, and the goal is to never miss your flight.

Built for the "Last-Minute Life Saver" challenge — moves beyond passive reminders into active prioritization, scheduling, and conversational replanning.

## Features

- **Today view** — a live timeline of the day's tasks, sized and positioned by actual time, with a moving "now" marker.
- **Priorities view** — tasks ranked by urgency × importance, with the reasoning shown for each ranking, not just the order.
- **Tower** — an AI panel that proactively surfaces the single most urgent action and flags scheduling conflicts, plus a real conversational assistant (powered by Claude) you can ask to replan your day on the fly.
- **Habits view** — streak tracking with an AI-generated observation about which habit is slipping and why.

## Project structure

```
src/            React frontend (Vite)
worker/         Cloudflare Worker — proxies requests to the Claude API, holds the secret key
.github/        GitHub Actions workflow that auto-deploys the frontend to GitHub Pages
```

## Quick start (local dev, no AI chat)

```bash
npm install
npm run dev
```

The app runs fully with mocked nudges/prioritization even with no backend. The "Ask Tower to replan" chat needs the proxy deployed — see below.

## Deploying for real (with working AI chat)

See **[DEPLOY.md](./DEPLOY.md)** for the full walkthrough. Short version: deploy the Cloudflare Worker first (it holds your API key safely), then push the frontend to GitHub Pages — the two are intentionally separate so your key is never exposed in the public repo or browser bundle.

## Why a proxy at all?

GitHub Pages only serves static files — there's no server to hide a secret on. Any API key embedded in frontend JS is visible to anyone who opens dev tools, the moment the site is public. The Cloudflare Worker is a small, free, separately-deployed service that holds the real key and is the only thing that ever calls Anthropic's API directly.
