// Reads supported attachments and turns them into prompt-friendly text.
// Images go to the multimodal channel separately — this helper handles the
// "drop a doc, prepend it as context" path.

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml',
  'log', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'go', 'py', 'rb',
  'java', 'c', 'cpp', 'h', 'hpp', 'rs', 'sh', 'sql', 'env', 'toml',
])

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml']

export interface ExtractResult {
  filename: string
  text: string
  charCount: number
  truncated: boolean
}

const MAX_CHARS_PER_FILE = 80_000

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isTextLike(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXTENSIONS.has(ext)) return true
  return TEXT_MIME_PREFIXES.some(p => file.type.startsWith(p))
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export async function readFileAsText(file: File): Promise<ExtractResult> {
  const text = await file.text()
  return capResult(file.name, text)
}

export async function readFileAsBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  return arrayBufferToBase64(buf)
}

export async function extractPdfText(file: File): Promise<ExtractResult> {
  const pdfjs = await import('pdfjs-dist')
  // Vite bundles the worker as an asset URL.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map(it => ('str' in it ? (it as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) parts.push(`--- page ${i} ---\n${pageText}`)
    if (parts.join('\n\n').length > MAX_CHARS_PER_FILE) break
  }
  return capResult(file.name, parts.join('\n\n'))
}

function capResult(filename: string, text: string): ExtractResult {
  if (text.length <= MAX_CHARS_PER_FILE) {
    return { filename, text, charCount: text.length, truncated: false }
  }
  return {
    filename,
    text: text.slice(0, MAX_CHARS_PER_FILE),
    charCount: text.length,
    truncated: true,
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // Avoid String.fromCharCode on huge arrays (stack overflow). Chunk it.
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

// Renders extracted file text as a fenced block we can prepend to the user's
// prompt. Keeps the user's typed message clearly separate.
export function formatExtractsForPrompt(extracts: ExtractResult[]): string {
  if (extracts.length === 0) return ''
  const blocks = extracts.map(e => {
    const trunc = e.truncated ? ` (truncated to ${MAX_CHARS_PER_FILE} chars of ${e.charCount})` : ''
    return `📎 ${e.filename}${trunc}\n\`\`\`\n${e.text}\n\`\`\``
  })
  return blocks.join('\n\n') + '\n\n---\n\n'
}
