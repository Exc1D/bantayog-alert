import { AppShell } from '@/components/layout/AppShell'
import { MessageSquare } from 'lucide-react'

export default function SmsPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <MessageSquare className="w-16 h-16 text-muted-foreground/70 mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">SMS Audit</h1>
        <p className="text-body-md text-muted-foreground">Coming soon &mdash; under construction</p>
      </div>
    </AppShell>
  )
}
