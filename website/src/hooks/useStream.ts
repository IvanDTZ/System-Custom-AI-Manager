import { useCallback, useEffect, useRef, useState } from 'react'
import { streamMessage } from '../api/chat'

/**
 * useStream — drives a single SSE chat stream.
 *
 * Design notes:
 * - Tokens land in a ref (`bufferRef`), not state. We only flush to React
 *   state once per animation frame so we re-render at most ~60Hz no matter
 *   how fast Ollama emits tokens. This is what makes the typing feel like
 *   ChatGPT instead of stuttering.
 * - The visible text exposed by the hook (`text`) updates per-frame.
 * - `state` reflects backend events: idle → queued → ready → streaming → done|error.
 */
export type StreamState = 'idle' | 'queued' | 'ready' | 'streaming' | 'done' | 'error'

export interface UseStreamResult {
  text: string
  state: StreamState
  queuePosition: number | null
  error: string | null
  start: (chatId: number, content: string, onDone?: (info: { chat_id: number; message_id: number }, finalText: string) => void) => void
  stop: () => void
  reset: () => void
}

export function useStream(): UseStreamResult {
  const [text, setText] = useState('')
  const [state, setState] = useState<StreamState>('idle')
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const bufferRef = useRef('')
  const dirtyRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)
  const onDoneRef = useRef<((info: { chat_id: number; message_id: number }, finalText: string) => void) | null>(null)

  const flush = useCallback(() => {
    rafRef.current = null
    if (!dirtyRef.current) return
    dirtyRef.current = false
    setText(bufferRef.current)
  }, [])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  const reset = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    bufferRef.current = ''
    dirtyRef.current = false
    setText('')
    setState('idle')
    setQueuePosition(null)
    setError(null)
  }, [])

  const stop = useCallback(() => {
    ctrlRef.current?.abort()
    ctrlRef.current = null
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setState(s => (s === 'idle' || s === 'done' || s === 'error' ? s : 'done'))
  }, [])

  const start = useCallback((chatId: number, content: string, onDone?: (info: { chat_id: number; message_id: number }, finalText: string) => void) => {
    // Cancel any in-flight stream first.
    ctrlRef.current?.abort()
    bufferRef.current = ''
    dirtyRef.current = false
    setText('')
    setError(null)
    setQueuePosition(null)
    setState('queued')
    onDoneRef.current = onDone ?? null

    ctrlRef.current = streamMessage(chatId, content, {
      onQueued: (pos) => {
        setQueuePosition(pos)
        setState('queued')
      },
      onReady: () => {
        setQueuePosition(null)
        setState('streaming')
      },
      onToken: (chunk) => {
        bufferRef.current += chunk
        dirtyRef.current = true
        // setState bails out if the value is unchanged, so this is cheap.
        setState('streaming')
        scheduleFlush()
      },
      onDone: (info) => {
        // Force a final flush so the last tokens are committed.
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        const finalText = bufferRef.current
        setText(finalText)
        setState('done')
        onDoneRef.current?.(info, finalText)
      },
      onError: (msg) => {
        setError(msg)
        setState('error')
      },
    })
  }, [scheduleFlush])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      ctrlRef.current?.abort()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { text, state, queuePosition, error, start, stop, reset }
}
