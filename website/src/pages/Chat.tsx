import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as chatApi from '../api/chat'
import type { Chat as ChatT, ChatMessage } from '../types'
import { Shell } from '../components/layout/Shell'
import { ChatSidebar } from '../components/chat/ChatSidebar'
import { Composer } from '../components/chat/Composer'
import { Message } from '../components/chat/Message'
import { ModelPicker } from '../components/chat/ModelPicker'

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
  const [streaming, setStreaming] = useState(false)
  const [streamBuf, setStreamBuf] = useState('')
  const ctrlRef = useRef<AbortController | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const refreshChats = useCallback(async () => {
    try {
      const r = await chatApi.listChats()
      setChats(r.chats)
    } catch { /* noop */ }
  }, [])

  useEffect(() => { refreshChats() }, [refreshChats])

  useEffect(() => {
    if (!idParam) { setChat(null); setMessages([]); return }
    const id = Number(idParam)
    chatApi.getChat(id).then(({ chat }) => {
      setChat(chat)
      setMessages(chat.messages ?? [])
      setModel(chat.model_name)
    }).catch(() => nav('/chat'))
  }, [idParam, nav])

  // Auto-scroll on new content
  useEffect(() => {
    const s = scrollerRef.current
    if (!s) return
    s.scrollTop = s.scrollHeight
  }, [messages, streamBuf])

  async function handleNewChat() {
    nav('/chat')
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this conversation?')) return
    await chatApi.deleteChat(id)
    if (chat?.id === id) nav('/chat')
    refreshChats()
  }

  async function handleSend(content: string) {
    if (!model) return alert('Please pick a model first.')

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
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setStreamBuf('')
    setStreaming(true)
    ctrlRef.current = chatApi.streamMessage(activeChat.id, content, {
      onToken: (t) => setStreamBuf(b => b + t),
      onDone: () => {
        setStreaming(false)
        setStreamBuf(buf => {
          if (buf) {
            setMessages(prev => [...prev, {
              id: Date.now(),
              chat_id: activeChat!.id,
              role: 'assistant',
              content: buf,
              model_name: model,
              created_at: new Date().toISOString(),
            }])
          }
          return ''
        })
        refreshChats()
      },
      onError: (msg) => {
        setStreaming(false)
        setMessages(prev => [...prev, {
          id: Date.now(),
          chat_id: activeChat!.id,
          role: 'assistant',
          content: `*Error: ${msg}*`,
          created_at: new Date().toISOString(),
        }])
        setStreamBuf('')
      },
    })
  }

  function handleStop() {
    ctrlRef.current?.abort()
    setStreaming(false)
    if (streamBuf) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        chat_id: chat?.id ?? 0,
        role: 'assistant',
        content: streamBuf,
        model_name: model,
        created_at: new Date().toISOString(),
      }])
    }
    setStreamBuf('')
  }

  const empty = messages.length === 0 && !streaming && !streamBuf

  const liveAssistant: ChatMessage | null = streamBuf
    ? {
        id: -1,
        chat_id: chat?.id ?? 0,
        role: 'assistant',
        content: streamBuf,
        model_name: model,
        created_at: new Date().toISOString(),
      }
    : null

  return (
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
        <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3">
          <div className="text-sm font-medium text-text-muted">
            {chat?.title || 'New conversation'}
          </div>
          <ModelPicker value={model} onChange={setModel} />
        </header>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 py-10">
              <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-white to-zinc-300 text-black shadow-2xl">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-7">
                  <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4Z" />
                </svg>
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">How can I help today?</h1>
              <p className="mt-2 text-text-muted">Pick a model and start typing — your conversation will appear here.</p>
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
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-7 px-6 py-8">
              {messages.map(m => (
                <Message key={m.id} message={m} />
              ))}
              {liveAssistant && <Message message={liveAssistant} streaming />}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-3">
          <Composer onSend={handleSend} onStop={handleStop} streaming={streaming} disabled={!model} />
          {!model && (
            <div className="mx-auto mt-2 max-w-3xl text-center text-xs text-amber-300/80">
              Pick a model from the top-right to start chatting.
            </div>
          )}
        </div>
      </div>

    </Shell>
  )
}
