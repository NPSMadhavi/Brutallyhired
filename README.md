# Verity — AI-powered candidate portal

A white-label candidate portal any company can plug into its careers site. A candidate clicks **Apply** on the
company's site, lands in Verity with the role pre-selected, signs in (Google, Microsoft, LinkedIn or a verified
email code), submits minimal details + CV (+ optional cover letter), and then follows the whole journey in one
place: public milestones, proctored assessment, interview booking and LiveKit video rooms, offer e-signing and
onboarding documents.

Nothing in the UI is hard-coded content: companies, jobs, questions, assessments, interview slots, offer terms
and onboarding checklists all come from the database; all interface copy lives in
`apps/candidate-portal/src/i18n/locales/en.json` (emails in `apps/backend/src/locales/email/en.json`). There is no seed or demo data.

## Monorepo

npm workspaces:

```
apps/
  admin-portal/       @verity/admin-portal — React + TypeScript + Vite, Tailwind (HR & Hiring Dashboard)
  backend/            @verity/backend — Node.js + TypeScript (Express, Socket.IO, Prisma, OIDC, LiveKit, SMTP)
  candidate-portal/   @verity/candidate-portal — React + TypeScript + Vite, Tailwind, React Hook Form + Zod
packages/
  db/                 @verity/db — Prisma schema + client (PostgreSQL)
  shared/             @verity/shared — Zod schemas, enums, DTO types and journey logic used by both apps
```

The admin portal (`apps/admin-portal`) provides a comprehensive HR and recruiter dashboard matching the candidate portal's design system, connected to the backend staff APIs.

### Backend (`apps/backend/src`)

```
routes/          one thin router per area: path → middlewares → controller
controllers/     request handlers: parse input, call services, shape the response
middlewares/     auth (session, CSRF), tenant + staff roles, uploads, rate limits, errors
services/        business logic: OIDC, accounts, sessions, scoring, resume reading, stages,
                 overview/next step, notifications, email, realtime, LiveKit, storage, files
serializers/     database rows → public DTOs (never internal scores or proctoring data)
utils/           errors, crypto, time, ICS, logger, request helpers
locales/email/   email copy
config/env.ts    validated environment
scripts/         create-tenant
```

### Candidate portal (`apps/candidate-portal/src`)

```
api/          React Query hooks for every endpoint
components/   journey/ (track, next step, updates), layout/ (portal shell, auth guard, tenant branding), ui/
hooks/        useProctoring, useRealtime
i18n/         all interface copy
lib/          api client, branding, formatting, socket
pages/        applications, apply, assessment, auth, interviews, notifications, offer, onboarding, profile
```

## Requirements

- Node.js 20.11+ (22 recommended) and npm 10+
- Docker (for local Postgres, LiveKit and Mailpit), or your own instances

## Getting started

```bash
cp .env.example .env            # then fill SESSION_SECRET, EMAIL_FROM and any OIDC providers
npm install
npm run infra:up                       # Postgres :5432, LiveKit :7880, Mailpit :8025 (web UI for emails)
npm run db:generate
npm run db:migrate -- --name init      # creates the first migration from packages/db/prisma/schema.prisma
npm run tenant:create -- --slug acme --name "Acme Ltd" --admin-email hr@acme.com \
  --brand "#0F5E59" --careers https://acme.com/careers --privacy https://acme.com/privacy --timezone Asia/Kolkata
npm run dev                            # backend on :4000 + candidate portal on :5173, in one terminal
```

The company's careers site links each role's **Apply** button to:

```
https://<portal-host>/<tenant-slug>/apply/<job externalRef>
```

## Authentication

| Method | How |
| --- | --- |
| Google / Microsoft / LinkedIn | OpenID Connect authorization-code flow, PKCE where supported, `state` + `nonce`, ID token verified against the provider's JWKS (`jose`). Microsoft's multi-tenant issuer is validated per `tid`. |
| Verified email | 6-digit code (HMAC-hashed, 10-minute TTL, 5 attempts, rate-limited). No passwords. |

Register these redirect URIs with each provider: `${API_ORIGIN}/api/auth/oidc/{google|microsoft|linkedin}/callback`.
A provider is enabled only when both its client id and secret are set.

**One person, one account.** Accounts are keyed by email. Verity never silently merges identities:

- An OIDC sign-in whose email already belongs to an account creates a *link intent*; the owner must sign in with an
  existing method and explicitly confirm (`/auth/link/:id`).
- If a provider does not vouch for the email (Microsoft often doesn't), the person proves it with an emailed code
  before any account is created (`/auth/verify-email/:id`).

Sessions are opaque random tokens (only the SHA-256 is stored), `HttpOnly`, `SameSite=Lax`, `__Host-` prefixed in
production. State-changing requests require the `x-verity-csrf` header and a matching `Origin`.

## What candidates see — and don't

The candidate API only ever returns **public** events and milestones (`Applied → In review → Assessment →
Interviews → Offer → Onboarding → First day`; the assessment step appears only when the job has one).
BrutalScore™ results, eligibility reviews, HR overrides, assessment auto-marks, proctoring events and recordings
are stored as internal data and are only reachable through the staff API.

## AI resume reading and scoring

- Text is extracted from PDF (unpdf), DOCX (mammoth) and RTF. When `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` are
  set (any OpenAI-compatible endpoint), the CV is summarised into job-related fields only; the prompt forbids
  personal traits. The candidate reviews and corrects the summary before submitting. Without AI configured the
  candidate enters key skills manually.
- `services/scoring.service.ts` produces an explainable internal score from job requirements (hard/preferred, keywords,
  weights), linked CV evidence and questionnaire completeness. It stores breakdown, confidence, missing information,
  job version and rubric/model version. Below the tenant's threshold it flags an **eligibility review** — it never
  rejects. HR overrides require a written reason.

## Proctoring

`apps/candidate-portal/src/hooks/useProctoring.ts` uses `getUserMedia` (camera + mic) and `getDisplayMedia` (whole screen, Screen
Capture API), records both with `MediaRecorder` in 10-second WebM chunks uploaded in order, and reports focus,
visibility, fullscreen, clipboard, network and multi-display signals. The server enforces the timer, strips correct
answers from questions it sends, and auto-marks choice questions internally. Signals are for human review only.
Make sure your privacy notice covers recording before enabling proctored assessments.

## Interviews (LiveKit)

HR creates a round with panelists and candidate-bookable slots. Candidates book (transactional, no double booking),
can change times up to 12 hours before, request other times, download an `.ics`, and join in-portal. Join tokens
are minted server-side only inside the join window (`INTERVIEW_JOIN_EARLY_MINUTES` / `..._LATE_MINUTES`).

## Real-time notifications

Socket.IO authenticates with the session cookie and joins `user:<id>`. Every public milestone creates a notification
row, pushes `notification:new` + `application:updated`, and sends a branded email (calendar invite attached for
bookings). Notification text is a message key rendered by the client in the candidate's language.

## Hiring-team (staff) API

The admin portal UI isn't built yet. Staff use the tenant-scoped API at
`/api/t/:tenant/admin/*` (roles `ADMIN`, `RECRUITER`, `INTERVIEWER`) to drive the pipeline:

| Action | Endpoint |
| --- | --- |
| Tenant settings / invite staff | `PUT /admin/settings`, `POST /admin/staff` |
| Create / update a job (requirements, questions) | `POST /admin/jobs`, `PUT /admin/jobs/:id` |
| List / inspect applications (with scores) | `GET /admin/applications`, `GET /admin/applications/:id` |
| Move stage / override eligibility (reason required) | `POST /admin/applications/:id/stage`, `POST /admin/applications/:id/eligibility-override` |
| Assessments | `POST /admin/assessment-templates`, `POST /admin/applications/:id/assessment-invites`, `GET /admin/attempts/:id/proctoring` |
| Interviews | `POST /admin/applications/:id/interviews`, `POST /admin/interviews/:id/complete`, `POST /admin/interviews/:id/join-token` |
| Offer | `PUT /admin/applications/:id/offer` (`send: true` to send), `POST /admin/applications/:id/offer/letter` |
| Onboarding | `PUT /admin/onboarding-template`, `POST /admin/onboarding-tasks/:id/review`, `PUT /admin/applications/:id/joining-details`, `POST /admin/applications/:id/hire` |

All request bodies are validated by the Zod schemas in `packages/shared/src/schemas/admin.ts`.

## Production notes

- Serve `apps/candidate-portal/dist` and reverse-proxy `/api` and `/socket.io` to the API on the same origin.
- Replace `LocalDiskStorage` (`apps/backend/src/services/storage.service.ts`) with object storage for multi-instance deployments.
- Run `npm run db:deploy` on release. Socket.IO across multiple API instances needs the Redis adapter.
- Add a locale by copying both `en.json` catalogs and registering it in `apps/candidate-portal/src/i18n/index.ts`.
