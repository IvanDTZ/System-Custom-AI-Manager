import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../ui/Button'

export function Composer({
  onSend,
  onStop,
  disabled,
  streaming,
}: {
  onSend: (content: string) => void
  onStop?: () => void
  disabled?: boolean
  streaming?: boolean
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = Math.min(ref.current.scrollHeight, 220) + 'px'
  }, [value])

  function send() {
    const v = value.trim()
    if (!v || disabled) return
    onSend(v)
    setValue('')
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask anything…"
          rows={1}
          className="block max-h-56 w-full resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-text-subtle"
        />
        <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
          <span className="text-[11px] text-text-subtle">Press Enter to send · Shift+Enter for newline</span>
          {streaming ? (
            <Button size="sm" variant="secondary" onClick={onStop}>
              Stop
            </Button>
          ) : (
            <Button size="sm" disabled={disabled || !value.trim()} onClick={send}>
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
