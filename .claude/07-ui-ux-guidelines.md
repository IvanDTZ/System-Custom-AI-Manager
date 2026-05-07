# 07 — UI / UX Guidelines

## Mood
Premium AI SaaS, dark, glassy, minimal. Lots of negative space. Focus on the content, not chrome.

## Tokens (defined in Tailwind theme)
| Token | Value | Usage |
|---|---|---|
| `bg-app` | `#08080b` | page background |
| `bg-surface` | `rgba(255,255,255,0.04)` | cards, sidebar |
| `bg-surface-strong` | `rgba(255,255,255,0.07)` | hover, active |
| `border-soft` | `rgba(255,255,255,0.08)` | hairline dividers |
| `border-strong` | `rgba(255,255,255,0.16)` | focused inputs |
| `text-primary` | `#f4f4f5` | body |
| `text-muted` | `#a1a1aa` | secondary |
| `text-subtle` | `#71717a` | tertiary |
| `accent` | `#a78bfa` | active state, links |
| `success` | `#34d399` | online dot |
| `danger` | `#f87171` | destructive |

## Components
- **Card**: `rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl`.
- **Primary button**: white-to-zinc gradient, dark text. `bg-gradient-to-b from-white to-zinc-300 text-black`.
- **Secondary button**: glass — `bg-white/5 hover:bg-white/10 border border-white/10 text-white`.
- **Input**: `bg-white/[0.03] border border-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/30`.
- **Modal**: backdrop blur 12px, surface card centered.
- **Dropdown** (model picker, role picker): glass surface, rounded-xl, with category headers.

## Layout
- **App Shell**: full-height grid, sidebar 280px on the left, content takes the rest.
- **Sidebar**: chat history grouped by date (Today / Yesterday / This week / Older), pinned "+ New chat" button, profile at the bottom with role badge.
- **Topbar**: only the model picker on the chat page, breadcrumbs + actions on admin pages.

## Chat
- Messages alternate alignment. User on the right with a tinted glass bubble; assistant on the left, full-width without a bubble (markdown-style, like ChatGPT).
- Code blocks use the project palette, with a "Copy" button that flashes "Copied" for 1s.
- Streaming shows a blinking cursor and a "Stop" button.
- Empty state: centered title + 4 example prompt cards.

## Admin
- Top metric cards (users / models / chats / Ollama status) in the dashboard.
- Tables with sticky header, row hover, status pill, action menu.
- Modals for create/edit; inline confirm for destructive actions.
