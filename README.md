# ChatApp — Frontend

Next.js (App Router) + TypeScript + Tailwind client for the ChatApp backend.
Realtime traffic goes over **Socket.IO**; file uploads use the backend's small
REST API (`/api/attachments`).

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

`NEXT_PUBLIC_API_URL` is optional: it points at the REST API used for file
uploads and downloads. It defaults to the socket URL's origin, which is where
the backend serves the API.

## Scripts

- `npm run dev` — start the dev server on port 3001
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint

## Structure

- `src/app` — routes: `/login` (sign in + sign up tabs) and `(chat)` (`/`, `/chat/[roomId]`)
- `src/components/providers` — Socket, Auth, Chat and Toast contexts
- `src/components/chat` — sidebar, room list, message pane/list, composer, dialogs
- `src/lib` — socket singleton, session store, ack-based `request()` helper, upload/download client
- `src/types/chat.ts` — shared types and the socket event contracts

## Notes

- Auth is over Socket.IO (`login`/`register`), and the JWT is kept in
  `localStorage`; an expired token triggers `auth_error`, which logs the user out.
- Messages are sent optimistically and reconciled with the server's
  `message:new` broadcast / ack.
- Attachments are uploaded over HTTP first (`POST /api/attachments`) and then
  referenced by the message that carries them. Files are capped at 10 MB and
  limited to images and common documents.
- Files are fetched with the session token rather than linked directly, so the
  token never ends up in a URL.
