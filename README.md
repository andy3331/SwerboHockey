# Swierbutowicz Hockey Development

Mobile-first Express/EJS website and booking MVP for a youth hockey training business in South Windsor, Connecticut.

## What It Includes

- homepage and coach credibility pages
- clinics listing and clinic detail pages
- booking, waitlist, private lesson, and express-interest flows
- confirmation and waiver follow-up pages
- lightweight admin dashboard for clinics, leads, bookings, waitlist, and private inquiries

## Stack

- Node.js
- Express
- EJS
- file-backed JSON persistence for MVP development

## Run Locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public site and [http://localhost:3000/admin](http://localhost:3000/admin) for the internal dashboard.

## Render Deploy

This repo includes `render.yaml` for a simple Render web service deploy.

Render setup:

```text
Branch: codex/public-launch
Build Command: npm install
Start Command: npm start
```

After deployment, share the Render URL with the client for review.

Important:

- The current MVP stores leads and bookings in a local JSON file.
- That is acceptable for short-lived review environments.
- It is not a production-safe persistence strategy unless you attach persistent storage or move to a real database.

## Notes

- This repo is intended to contain only the application code and public assets.
- Internal planning documents, private operating notes, and live lead data should stay out of version control.
