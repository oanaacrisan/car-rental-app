# Vehicle Rental Platform

Bachelor's thesis project developed as a multilingual vehicle-rental platform for customer and administrative workflows.

## Features

- Vehicle catalog with date-based availability checks
- Booking flow with document uploads and insurance options
- Demand-based dynamic pricing and nearby lower-price suggestions
- Romanian, English and German interfaces
- Customer booking lookup with signed access tokens
- Admin dashboard for fleet, bookings, maintenance and return inspections
- Booking status emails and final settlement PDF generation
- Contextual FAQ assistant for rental and pricing questions
- Input validation, rate limiting, same-origin checks and security headers

## Technology

- Next.js 16 and React 19
- TypeScript and Tailwind CSS
- Supabase with PostgreSQL and object storage
- Resend for transactional email
- Vercel-compatible deployment

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and replace every placeholder with your own configuration. Never commit `.env` or `.env.local`.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Validation

Run the project checks before publishing changes:

```bash
npm run lint
npm run build
```

## Security note

Server credentials, administrator credentials and signing secrets are required through environment variables. The repository contains placeholders only.

This public portfolio version uses CSS-generated visual backgrounds and does not include third-party vehicle photography.
