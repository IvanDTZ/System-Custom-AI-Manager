import { useEffect, useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

// In-app replacements for window.confirm / window.alert. Same async ergonomics:
//   if (!await confirm({ title: '…', danger: true })) return
//   await notify({ title: '…' })

export interface ConfirmOptions {
  title?: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface NotifyOptions {
  title?: string
  message?: ReactNode
  okLabel?: string
  tone?: 'info' | 'success' | 'danger'
}

type ActiveDialog =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'notify'; options: NotifyOptions; resolve: () => void }
  | null

let push: ((d: Exclude<ActiveDialog, null>) => void) | null = null

export function confirm(options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise(resolve => {
    if (!push) {
      const fallback = window.confirm(stringOf(options.message ?? options.title ?? 'Are you sure?'))
      resolve(fallback)
      return
    }
    push({ kind: 'confirm', options, resolve })
  })
}

export function notify(options: NotifyOptions = {}): Promise<void> {
  return new Promise(resolve => {
    if (!push) {
      window.alert(stringOf(options.message ?? options.title ?? ''))
      resolve()
      return
    }
    push({ kind: 'notify', options, resolve })
  })
}

function stringOf(node: ReactNode): string {
  return typeof node === 'string' ? node : ''
}

export function DialogHost() {
  const [dialog, setDialog] = useState<ActiveDialog>(null)

  useEffect(() => {
    push = (d) => setDialog(d)
    return () => {
      push = null
    }
  }, [])

  if (!dialog) return null

  if (dialog.kind === 'confirm') {
    const { options, resolve } = dialog
    const close = (ok: boolean) => {
      resolve(ok)
      setDialog(null)
    }
    return (
      <Modal
        open
        onClose={() => close(false)}
        title={options.title ?? 'Are you sure?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {options.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={options.danger ? 'danger' : 'primary'}
              onClick={() => close(true)}
              autoFocus
            >
              {options.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {options.message && (
          <div className="text-sm leading-relaxed text-text-muted">{options.message}</div>
        )}
      </Modal>
    )
  }

  const { options, resolve } = dialog
  const close = () => {
    resolve()
    setDialog(null)
  }
  const accent =
    options.tone === 'success'
      ? 'text-emerald-300'
      : options.tone === 'danger'
      ? 'text-red-300'
      : 'text-white'
  return (
    <Modal
      open
      onClose={close}
      title={<span className={accent}>{options.title ?? 'Notice'}</span>}
      footer={<Button onClick={close} autoFocus>{options.okLabel ?? 'OK'}</Button>}
    >
      {options.message && (
        <div className="text-sm leading-relaxed text-text-muted">{options.message}</div>
      )}
    </Modal>
  )
}
