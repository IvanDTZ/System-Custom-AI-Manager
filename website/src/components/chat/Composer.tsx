import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Button } from '../ui/Button'
import {
  extractPdfText,
  formatExtractsForPrompt,
  isImageFile,
  isPdf,
  isTextLike,
  readFileAsBase64,
  readFileAsText,
  type ExtractResult,
} from '../../utils/extractText'
import { isVisionModel } from '../../utils/visionModels'

const ACCEPTED = [
  'image/*',
  'application/pdf',
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.xml',
  '.yaml', '.yml', '.log', '.html', '.css',
  '.js', '.ts', '.tsx', '.jsx', '.go', '.py', '.rb', '.java',
  '.c', '.cpp', '.h', '.hpp', '.rs', '.sh', '.sql', '.toml',
].join(',')

const MAX_IMAGE_BYTES = 8 * 1024 * 1024  // 8 MB per image
const MAX_FILE_BYTES = 16 * 1024 * 1024  // 16 MB per text/pdf

type AttachmentKind = 'image' | 'text' | 'pdf'

interface Attachment {
  id: string
  file: File
  kind: AttachmentKind
  status: 'reading' | 'ready' | 'error'
  // For images: the base64 payload (no data URL prefix) and a preview URL.
  imageBase64?: string
  previewUrl?: string
  // For text/pdf: extracted plain text.
  extract?: ExtractResult
  errorMessage?: string
}

export interface ComposerSendPayload {
  content: string
  images?: string[]
}

export function Composer({
  onSend,
  onStop,
  disabled,
  streaming,
  currentModel,
}: {
  onSend: (payload: ComposerSendPayload) => void
  onStop?: () => void
  disabled?: boolean
  streaming?: boolean
  currentModel?: string
}) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = Math.min(ref.current.scrollHeight, 220) + 'px'
  }, [value])

  // Revoke object URLs when attachments unmount or change.
  useEffect(() => {
    return () => {
      attachments.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stillReading = attachments.some(a => a.status === 'reading')
  const hasImages = attachments.some(a => a.kind === 'image' && a.status === 'ready')
  const visionMismatch = hasImages && !!currentModel && !isVisionModel(currentModel)
  const canSend = !disabled && !stillReading && (value.trim().length > 0 || attachments.length > 0)

  function send() {
    if (!canSend) return
    const ready = attachments.filter(a => a.status === 'ready')
    const images = ready.filter(a => a.kind === 'image').map(a => a.imageBase64!).filter(Boolean)
    const docs = ready
      .filter(a => a.kind === 'text' || a.kind === 'pdf')
      .map(a => a.extract!)
      .filter(Boolean)
    const prefix = formatExtractsForPrompt(docs)
    const userText = value.trim()
    const content = prefix
      ? userText
        ? prefix + userText
        : prefix + 'Please summarise / analyse the attached document(s).'
      : userText
    onSend({ content, images: images.length ? images : undefined })
    setValue('')
    attachments.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    setAttachments([])
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function classify(file: File): AttachmentKind | null {
    if (isImageFile(file)) return 'image'
    if (isPdf(file)) return 'pdf'
    if (isTextLike(file)) return 'text'
    return null
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const arr = Array.from(files)
    const next: Attachment[] = []
    for (const file of arr) {
      const kind = classify(file)
      if (!kind) {
        next.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          kind: 'text',
          status: 'error',
          errorMessage: 'Unsupported file type',
        })
        continue
      }
      const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_FILE_BYTES
      if (file.size > limit) {
        next.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          kind,
          status: 'error',
          errorMessage: `Too large (max ${Math.round(limit / 1024 / 1024)} MB)`,
        })
        continue
      }
      next.push({
        id: `${Date.now()}-${Math.random()}-${file.name}`,
        file,
        kind,
        status: 'reading',
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
      })
    }
    setAttachments(prev => [...prev, ...next])

    for (const att of next) {
      if (att.status !== 'reading') continue
      try {
        if (att.kind === 'image') {
          const b64 = await readFileAsBase64(att.file)
          setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, imageBase64: b64, status: 'ready' } : a))
        } else if (att.kind === 'pdf') {
          const extract = await extractPdfText(att.file)
          setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, extract, status: 'ready' } : a))
        } else {
          const extract = await readFileAsText(att.file)
          setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, extract, status: 'ready' } : a))
        }
      } catch (err) {
        setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, status: 'error', errorMessage: (err as Error).message } : a))
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeAttachment(id: string) {
    setAttachments(prev => {
      const target = prev.find(a => a.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter(a => a.id !== id)
    })
  }

  function onPickFiles(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {visionMismatch && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-200">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-4 shrink-0">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          <div>
            <span className="font-medium text-amber-100">{currentModel}</span> doesn't support images. The text in your message will reach the model, but images will be ignored.
            <div className="mt-0.5 text-[11px] text-amber-200/80">
              Install a vision model from <span className="font-medium">Admin → Models</span> (e.g. <code className="rounded bg-white/10 px-1">llava:7b</code>) and switch to it in the model picker.
            </div>
          </div>
        </div>
      )}
      <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pb-2 pt-1">
            {attachments.map(att => (
              <AttachmentChip key={att.id} att={att} onRemove={() => removeAttachment(att.id)} />
            ))}
          </div>
        )}
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={disabled ? 'Pick a model first…' : 'Ask anything, or drop an image, PDF or text file…'}
          rows={1}
          className="block max-h-56 w-full resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-text-subtle"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-1">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              multiple
              onChange={onPickFiles}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || streaming}
              aria-label="Attach files"
              className="grid size-8 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <span className="text-[11px] text-text-subtle">
              {stillReading ? 'Reading attachments…' : 'Enter to send · Shift+Enter newline · 📎 to attach'}
            </span>
          </div>
          {streaming ? (
            <Button size="sm" variant="secondary" onClick={onStop}>Stop</Button>
          ) : (
            <Button size="sm" disabled={!canSend} onClick={send}>Send</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function AttachmentChip({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const error = att.status === 'error'
  const reading = att.status === 'reading'
  return (
    <div className={`group relative flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs ${error ? 'border-red-400/40 bg-red-500/10 text-red-200' : 'border-white/10 bg-white/[0.05] text-white'}`}>
      {att.kind === 'image' && att.previewUrl ? (
        <img src={att.previewUrl} alt={att.file.name} className="size-8 rounded-md object-cover" />
      ) : (
        <span className="grid size-8 place-items-center rounded-md bg-white/[0.06]">
          {att.kind === 'pdf' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" x2="15" y1="13" y2="13" />
              <line x1="9" x2="15" y1="17" y2="17" />
            </svg>
          )}
        </span>
      )}
      <div className="flex max-w-[160px] flex-col">
        <span className="truncate font-medium">{att.file.name}</span>
        <span className="text-[10px] text-text-subtle">
          {reading ? 'reading…' : error ? att.errorMessage : att.extract?.truncated ? `${att.extract.charCount.toLocaleString()} chars (truncated)` : att.kind}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="grid size-5 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
