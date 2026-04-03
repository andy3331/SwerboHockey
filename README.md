# Swierbutowicz Hockey Development

Swierbutowicz Hockey Development is a mobile-first website and booking MVP for a youth hockey training business in South Windsor, Connecticut. The project is designed to help parents find the right clinic, request private lessons, join waitlists when sessions are full, and stay captured in the system so no lead is lost.

## Product Goal

Build a clear, trust-driven youth sports website that turns parent interest into one of four outcomes:

- clinic booking
- waitlist signup
- private lesson request
- general interest lead capture

Every public flow is designed to avoid dead ends and preserve the next best path for the family.

## Current MVP Scope

### Public site

- conversion-focused homepage
- clinics listing page with live status states
- clinic detail page with booking, waitlist, and fallback logic
- coach credibility and about page
- private lesson request page
- contact and express-interest page
- confirmation pages for booking, waitlist, private inquiry, and general interest
- waiver follow-up page

### Admin dashboard

- upcoming clinic overview
- clinic create and edit tools
- lead create and edit tools
- manual lead-to-session assignment
- bookings view
- waitlist view with promotion to booking
- private inquiry follow-up management
- editable lead records with source and status visibility

## Core Business Rules

- clinics have minimum, target, and max enrollment thresholds
- full clinics route families to waitlist instead of blocking them
- unavailable sessions fall back to lead capture instead of losing interest
- booking, waitlist, private inquiry, and interest submissions all create or update a lead
- the MVP avoids accounts and authentication to keep operations simple

## Tech Stack

- Node.js
- Express
- EJS
- vanilla CSS
- file-backed JSON persistence for MVP development

## Local Development

```powershell
npm install
npm run dev
```

Open these routes locally:

- Public site: [http://localhost:3000](http://localhost:3000)
- Admin dashboard: [http://localhost:3000/admin](http://localhost:3000/admin)

## Deployment

This repo includes `render.yaml` for a simple Render web service deploy.

Recommended review deployment:

```text
Branch: codex/public-launch
Build Command: npm install
Start Command: npm start
```

After deployment, send the Render URL to the client for review.

## Important MVP Note

The current build stores clinics, leads, bookings, waitlist entries, and private inquiries in a local JSON file. That is acceptable for local development and short-lived review environments, but it is not a production-safe persistence strategy without persistent storage or a real database.

## Repository Policy

This public repo is intended to contain application code and public assets only. Internal planning documents, private operating materials, local environment files, and live lead data are intentionally excluded from version control.
