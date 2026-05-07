import { Link, useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export default function PendingApproval() {
  const [params] = useSearchParams()
  const status = params.get('status') ?? 'pending'

  const copy =
    status === 'disabled'
      ? {
          title: 'Account disabled',
          body: 'Your account has been disabled by an administrator. Contact your admin if you think this is a mistake.',
        }
      : status === 'error'
      ? {
          title: 'Sign-in failed',
          body: params.get('message') || 'Something went wrong during the Google sign-in. Please try again.',
        }
      : {
          title: 'Account pending approval',
          body: 'Your account was created, but it is pending approval by an administrator. You will be able to sign in once it is approved.',
        }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <Card className="w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-amber-400/30 bg-amber-500/15">
          <svg viewBox="0 0 24 24" className="size-6 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{copy.body}</p>
        <Link to="/login" className="mt-5 inline-block">
          <Button variant="secondary">Back to sign-in</Button>
        </Link>
      </Card>
    </div>
  )
}
