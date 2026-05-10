import { useCallback, useEffect, useRef, useState } from 'react'
import { streamMessage } from '../api/chat'

/**
 * useStream — drives a single SSE chat stream with a typewriter renderer.
 *
 * Two timelines:
 *   - The network: tokens land in `bufferRef` as fast as Ollama emits them.
 *   - The viewer:  what's displayed advances at a controlled rate so the user
 *                  sees a smooth, ChatGPT-like typing effect instead of jumpy
 *                  bursts when Ollama flushes 5–15 tokens at once.
 *
 * The typewriter is *adaptive*: when the buffer gets way ahead, we let the
 * pen go faster so the user isn't watching a finished response slowly type
 * itself out. Ranges (chars per animation frame, ~60 fps):
 *   - lag ≤ 60   → 1   (calm typing, ~60 cps)
 *   - lag ≤ 250  → 2-6 (model is faster than us, accelerate)
 *   - lag > 250  → 4-N (way behind, large jumps)
 */
export type StreamState = 'idle' | 'queued' | 'ready' | 'streaming' | 'done' | 'error'

export interface UseStreamResult {
  text: string
  state: StreamState
  queuePosition: number | null
  error: string | null
  start: (chatId: number, content: string, opts?: { images?: string[]; onDone?: (info: { chat_id: number; message_id: number }, finalText: string) => void }) => void
  stop: () => void
  reset: () => void
}

export function useStream(): UseStreamResult {
  const [text, setText] = useState('')
  const [state, setState] = useState<StreamState>('idle')
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const bufferRef = useRef('')
  const displayedRef = useRef(0)
  const isStreamingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)
  const onDoneRef = useRef<((info: { chat_id: number; message_id: number }, finalText: string) => void) | null>(null)
  const pendingDoneRef = useRef<{ info: { chat_id: number; message_id: number }; finalText: string } | null>(null)

  const tick = useCallback(() => {
    rafRef.current = null

    const target = bufferRef.current.length
    let current = displayedRef.current

    if (current < target) {
      const lag = target - current
      let perFrame: number
      if (lag > 250) perFrame = Math.max(4, Math.ceil(lag / 25))
      else if (lag > 60) perFrame = Math.max(2, Math.ceil(lag / 40))
      else perFrame = 1
      current = Math.min(target, current + perFrame)
      displayedRef.current = current
      setText(bufferRef.current.slice(0, current))
    }

    // Emit `done` only after the typewriter has caught up to the final buffer.
    if (
      pendingDoneRef.current &&
      !isStreamingRef.current &&
      displayedRef.current >= bufferRef.current.length
    ) {
      const { info, finalText } = pendingDoneRef.current
      pendingDoneRef.current = null
      setState('done')
      onDoneRef.current?.(info, finalText)
      return
    }

    // Keep ticking while there's buffer pending OR the network is still open.
    if (current < bufferRef.current.length || isStreamingRef.current || pendingDoneRef.current) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [])

  const ensureTicking = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const reset = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    bufferRef.current = ''
    displayedRef.current = 0
    isStreamingRef.current = false
    pendingDoneRef.current = null
    setText('')
    setState('idle')
    setQueuePosition(null)
    setError(null)
  }, [])

  const stop = useCallback(() => {
    ctrlRef.current?.abort()
    ctrlRef.current = null
    isStreamingRef.current = false
    pendingDoneRef.current = null
    // Snap to whatever made it through so the user isn't left with a half-typed
    // partial when they hit Stop.
    displayedRef.current = bufferRef.current.length
    setText(bufferRef.current)
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setState(s => (s === 'idle' || s === 'done' || s === 'error' ? s : 'done'))
  }, [])

  const start = useCallback((chatId: number, content: string, opts?: { images?: string[]; onDone?: (info: { chat_id: number; message_id: number }, finalText: string) => void }) => {
    ctrlRef.current?.abort()
    bufferRef.current = ''
    displayedRef.current = 0
    isStreamingRef.current = true
    pendingDoneRef.current = null
    setText('')
    setError(null)
    setQueuePosition(null)
    setState('queued')
    onDoneRef.current = opts?.onDone ?? null

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
        setState('streaming')
        ensureTicking()
      },
      onDone: (info) => {
        isStreamingRef.current = false
        // Defer the `done` state until the typewriter has shown everything.
        pendingDoneRef.current = { info, finalText: bufferRef.current }
        ensureTicking()
      },
      onError: (msg) => {
        isStreamingRef.current = false
        pendingDoneRef.current = null
        setError(msg)
        setState('error')
      },
    }, opts?.images)
  }, [ensureTicking])

  useEffect(() => {
    return () => {
      ctrlRef.current?.abort()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { text, state, queuePosition, error, start, stop, reset }
}
