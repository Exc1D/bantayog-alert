# Bantayog Alert

Disaster reporting and alerting platform for Camarines Norte, Philippines.

## Quick Start for AI Agents

**Read these files FIRST before writing any code:**

1. `docs/citizen-role-spec.md` - Citizen features
2. `docs/responder-role-spec.md` - Responder features
3. `docs/municipal-admin-role-spec.md` - Municipal Admin features
4. `docs/provincial-superadmin-role-spec.md` - Provincial Superadmin features
5. `docs/communication-architecture.md` - **CRITICAL: No chat features**

## Tech Stack

- **Frontend:** React 18.3.1 + Vite 5.4.11 + TypeScript 6.0.2
- **Styling:** Tailwind CSS v3.4.17
- **Backend:** Firebase (Firestore, Functions, Auth, Storage, Hosting)
- **Maps:** Leaflet + react-leaflet v4.2.1
- **State:** TanStack Query 5.96.2 + Zustand 5.0.12
- **Routing:** React Router 6.5.0
- **Testing:** Vitest + Playwright + Firebase Emulator

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format

# Start Firebase emulators
npm run emulators:start
```

## Critical Constraints

- **NO chat features** - All two-way communication via Facebook Messenger or phone
- **MFA MANDATORY** for Provincial Superadmins
- **6-month data retention** - Auto-archive, then delete
- **Map-centric** for Municipal Admins (desktop)
- **Mobile-first** for Citizens and Responders

## Project Status

**Phase 0: Project Setup** ✅ Complete

- ✅ Vite + React + TypeScript initialized
- ✅ All dependencies installed
- ✅ Tailwind CSS configured
- ✅ Firebase emulators configured
- ✅ Domains folder structure created
- ✅ Testing infrastructure (Vitest, Playwright)
- ✅ ESLint + Prettier configured
- ✅ Environment files created
- ✅ Hello World test passing

## Next Steps

See `docs/AI-IMPLEMENTATION-GUIDE.md` for detailed implementation plan.

**Phase 1: Authentication & Data Model** (Next)
- Firebase Auth setup
- Custom claims for roles
- MFA for superadmins
- Firestore collections
- Security rules
