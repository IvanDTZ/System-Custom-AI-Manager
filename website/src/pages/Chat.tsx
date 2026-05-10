import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as chatApi from '../api/chat'
import { confirm, notify } from '../components/ui/dialogs'
import type { Chat as ChatT, ChatMessage } from '../types'
import { Shell, SidebarTrigger } from '../components/layout/Shell'
import { SidebarProvider } from '../contexts/SidebarContext'
import { ChatSidebar } from '../components/chat/ChatSidebar'
import { Composer } from '../components/chat/Composer'
import { Message } from '../components/chat/Message'
import { LiveMessage } from '../components/chat/LiveMessage'
import { ModelPicker } from '../components/chat/ModelPicker'
import { useStream } from '../hooks/useStream'

const SUGGESTIONS = [
  { title: 'Explain a concept', subtitle: 'Como si tuviera 12 años' },
  { title: 'Refactor TypeScript', subtitle: 'Suggest cleaner patterns' },
  { title: 'Write a release note', subtitle: 'From a list of commits' },
  { title: 'Translate to English', subtitle: 'Keep tone and nuance' },
]

export default function ChatPage() {
  const { id: idParam } = useParams()
  const nav = useNavigate()

  const [chats, setChats] = useState<ChatT[]>([])
  const [chat, setChat] = useState<ChatT | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [model, setModel] = useState<string>('')
  const stream = useStream()
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const userScrolledUpRef = useRef(false)

  const refreshChats = useCallback(async () => {
    try {
      const r = await chatApi.listChats()
      setChats(r.chats)
    } catch { /* noop */ }
  }, [])

  useEffect(() => { refreshChats() }, [refreshChats])

  useEffect(() => {
    if (!idParam) { setChat(null); setMessages([]); stream.reset(); return }
    const id = Number(idParam)
    chatApi.getChat(id).then(({ chat }) => {
      setChat(chat)
      setMessages(chat.messages ?? [])
      setModel(chat.model_name)
      stream.reset()
    }).catch(() => nav('/chat'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam])

  // Smart auto-scroll: only stick to bottom while the user hasn't scrolled up.
  useEffect(() => {
    const s = scrollerRef.current
    if (!s) return
    function onScroll() {
      const distance = s!.scrollHeight - s!.scrollTop - s!.clientHeight
      userScrolledUpRef.current = distance > 80
    }
    s.addEventListener('scroll', onScroll, { passive: true })
    return () => s.removeEventListener('scroll', onScroll)
  }, [chat?.id])

  useEffect(() => {
    const s = scrollerRef.current
    if (!s) return
    if (!userScrolledUpRef.current) s.scrollTop = s.scrollHeight
  }, [messages, stream.text, stream.state])

  function handleNewChat() {
    nav('/chat')
  }

  async function handleDelete(id: number) {
    const ok = await confirm({
      title: 'Delete conversation',
      message: 'This conversation and all its messages will be permanently deleted.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    await chatApi.deleteChat(id)
    if (chat?.id === id) nav('/chat')
    refreshChats()
  }

  async function handleSend(payload: string | { content: string; images?: string[] }) {
    if (!model) {
      await notify({
        title: 'Pick a model first',
        message: 'Open the model selector at the top-right and choose one before sending.',
        tone: 'info',
      })
      return
    }
    const content = typeof payload === 'string' ? payload : payload.content
    const images = typeof payload === 'string' ? undefined : payload.images

    let activeChat = chat
    if (!activeChat) {
      const { chat: created } = await chatApi.createChat(model, 'New chat')
      activeChat = created
      setChat(created)
      nav(`/chat/${created.id}`, { replace: true })
    }

    const userMsg: ChatMessage = {
      id: -Date.now(),
      chat_id: activeChat.id,
      role: 'user',
      content,
      images,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    userScrolledUpRef.current = false

    stream.start(activeChat.id, content, {
      images,
      onDone: (info, finalText) => {
        setMessages(prev => [...prev, {
          id: info.message_id || Date.now(),
          chat_id: info.chat_id,
          role: 'assistant',
          content: finalText,
          model_name: model,
          created_at: new Date().toISOString(),
        }])
        refreshChats()
      },
    })
  }

  function handleStop() {
    if (!stream.text) {
      stream.stop()
      return
    }
    // Persist what we have so far client-side. The backend already persists
    // the partial assistant message when the connection drops.
    setMessages(prev => [...prev, {
      id: Date.now(),
      chat_id: chat?.id ?? 0,
      role: 'assistant',
      content: stream.text,
      model_name: model,
      created_at: new Date().toISOString(),
    }])
    stream.stop()
  }

  const isStreaming = stream.state === 'streaming' || stream.state === 'queued' || stream.state === 'ready'
  const showLive = isStreaming || (stream.state === 'error' && !!stream.error)
  const empty = messages.length === 0 && !showLive

  const liveHint =
    stream.state === 'queued'
      ? `Queued${stream.queuePosition ? ` · #${stream.queuePosition}` : ''}`
      : stream.state === 'ready'
      ? 'Generating…'
      : undefined

  return (
    <SidebarProvider>
    <Shell
      sidebar={
        <ChatSidebar
          chats={chats}
          activeId={chat?.id}
          onNewChat={handleNewChat}
          onDelete={handleDelete}
        />
      }
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 sm:px-6 sm:py-3">
          <SidebarTrigger />
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-text-muted">
            {chat?.title || 'New conversation'}
          </div>
          <ModelPicker value={model} onChange={setModel} />
        </header>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
              <img src="/Logo.png" alt="AI Manager" className="size-36 rounded-3xl object-contain shadow-2xl sm:size-44 md:size-52" />
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">How can I help today?</h1>

              {!model ? (
                <div className="mt-6 w-full max-w-xl rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-5 text-center">
                  <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-amber-300/15 text-amber-200">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                      <path d="m12 19-7-7 7-7" />
                      <path d="M19 12H5" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-medium text-amber-100">Pick a model to start</h2>
                  <p className="mt-1.5 text-sm text-amber-200/80">
                    Open the <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-medium text-white">Model</span> selector at the top-right of this page and choose one. The chat input is disabled until then.
                  </p>
                  <p className="mt-3 text-xs text-amber-200/60">
                    No models in the list? Go to <span className="font-medium text-amber-100">Admin → Models</span>, click <span className="font-medium text-amber-100">Sync</span>, then enable one.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-text-muted">Pick a suggestion or just start typing.</p>
                  <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s.title}
                        onClick={() => handleSend(`${s.title} — ${s.subtitle}`)}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left transition-colors hover:border-white/15 hover:bg-white/[0.06]"
                      >
                        <div className="text-sm font-medium">{s.title}</div>
                        <div className="mt-0.5 text-xs text-text-muted">{s.subtitle}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-3 py-6 sm:gap-7 sm:px-6 sm:py-8">
              {messages.map(m => <Message key={m.id} message={m} />)}
              {showLive && (
                <LiveMessage text={stream.text} modelName={model} hint={liveHint} />
              )}
              {stream.state === 'error' && stream.error && (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {stream.error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-3 pb-4 pt-3 sm:px-6 sm:pb-6">
          <Composer
            onSend={handleSend}
            onStop={handleStop}
            streaming={isStreaming}
            disabled={!model}
            currentModel={model}
          />
          {!model && (
            <div className="mx-auto mt-2 max-w-3xl text-center text-xs text-amber-300/80">
              Pick a model from the top-right to start chatting.
            </div>
          )}
        </div>
      </div>
    </Shell>
    </SidebarProvider>
  )
}
