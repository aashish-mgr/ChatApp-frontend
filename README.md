# ChatApp — Frontend

Next.js (App Router) + TypeScript + Tailwind client for the ChatApp backend.
All realtime traffic goes over **Socket.IO** — there is no REST layer.

## Requirements

- Node.js 20+
- The `chat_backend` server running (defaults to `http://localhost:3000`)

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on **http://localhost:3001** (see `package.json`). Open that
URL; you'll be redirected to `/login`.

### Environment

Create `.env.local` (see `.env.example`):

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

This must point at the Socket.IO backend. If unset, the client falls back to
`http://localhost:3000` (dev default only — always set it in production).

## Scripts

- `npm run dev` — start the dev server on port 3001
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint

## Structure

- `src/app` — routes: `/login` (sign in + sign up tabs) and `(chat)` (`/`, `/chat/[roomId]`)
- `src/components/providers` — Socket, Auth, Chat and Toast contexts
- `src/components/chat` — sidebar, room list, message pane/list, composer, dialogs
- `src/lib` — socket singleton, session store, ack-based `request()` helper
- `src/types/chat.ts` — shared types and the socket event contracts

## Notes

- Auth is over Socket.IO (`login`/`register`), and the JWT is kept in
  `localStorage`; an expired token triggers `auth_error`, which logs the user out.
- Messages are sent optimistically and reconciled with the server's
  `message:new` broadcast / ack.
