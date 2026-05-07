# 03 — Frontend React Plan

## Stack
- React 19 + React Compiler (already configured in `vite.config.ts`).
- TypeScript (already configured).
- Vite (already configured).
- **Added**: Tailwind CSS, React Router, React Markdown, React Syntax Highlighter.

## New dependencies to install
```bash
cd website
npm install react-router-dom react-markdown remark-gfm rehype-highlight clsx
npm install -D tailwindcss @tailwindcss/vite
```

> We use the new Tailwind v4 + Vite plugin (`@tailwindcss/vite`) to avoid the old `postcss.config.js` step. The plugin is added to `vite.config.ts`.

## File layout
```
website/src/
├── api/                  # typed wrappers
│   ├── client.ts         # base fetch with auth header + error handling
│   ├── auth.ts
│   ├── chat.ts
│   ├── users.ts
│   └── models.ts
├── auth/
│   ├── AuthContext.tsx
│   ├── ProtectedRoute.tsx
│   └── useAuth.ts
├── components/
│   ├── ui/               # Button, Card, Input, Dropdown, Modal, Spinner
│   ├── layout/           # Shell, Sidebar, Topbar
│   ├── chat/             # ChatView, MessageList, Message, CodeBlock, ModelPicker
│   └── admin/            # UserTable, ModelTable, CategoryEditor, …
├── pages/
│   ├── Login.tsx
│   ├── PendingApproval.tsx
│   ├── Chat.tsx
│   ├── AdminDashboard.tsx
│   ├── AdminUsers.tsx
│   ├── AdminModels.tsx
│   ├── AdminCategories.tsx
│   └── AdminChats.tsx
├── routes/AppRoutes.tsx
├── hooks/                # useStream, useAutoScroll, …
├── types/                # User, Chat, Message, AIModel, Category
├── utils/                # cn, formatDate
├── styles/index.css      # Tailwind directives + global tokens
├── App.tsx
└── main.tsx
```

## Visual identity
- Background: deep neutral (`#0a0a0d` → `#101015`) with a subtle radial glow.
- Cards: `rgba(255,255,255,0.04)` background, `rgba(255,255,255,0.08)` border, soft blur.
- Text: white (`#f4f4f5`), muted (`#a1a1aa`).
- Accent: white-to-zinc gradient on primary buttons; subtle violet (`#a78bfa`) for active states.
- Rounded `xl`/`2xl`, `shadow-lg`, soft hover transitions.

## Streaming chat
`useStream(chatId, modelName, content)` — opens a `fetch` POST with `text/event-stream`, parses `data:` lines, appends tokens to the assistant message in state until a `done` event arrives.

## Markdown + code blocks
`react-markdown` with `remark-gfm` and `rehype-highlight`. We override the `code` component to render fenced code blocks with:
- The detected language label.
- A "Copy" button.
- Dark background with the project's palette (overrides default `highlight.js` theme).
