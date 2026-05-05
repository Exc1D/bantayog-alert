import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { ReconnectBanner } from './ReconnectBanner'
import { SlideInPanel } from './SlideInPanel'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { ToastSystem } from '@/components/common/ToastSystem'
import { useUIStore } from '@/stores/uiStore'
import { useKeyboardShortcuts } from '@/lib/keyboardShortcuts'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarCollapsed, panelOpen, activePanel, closePanel } = useUIStore()
  useKeyboardShortcuts()

  const panelTitles: Record<string, string> = {
    municipal: 'Municipality Details',
    incident: 'Incident Details',
    user: 'User Details',
  }

  return (
    <div className="min-h-[100dvh] bg-white">
      <Header />
      <ReconnectBanner />
      <Sidebar />

      <main
        className={cn(
          'pt-[56px] transition-all duration-200',
          sidebarCollapsed ? 'pl-16' : 'pl-[240px]',
        )}
      >
        <div className="p-6">{children}</div>
      </main>

      <SlideInPanel
        open={panelOpen}
        onClose={closePanel}
        title={panelTitles[activePanel] ?? 'Details'}
      >
        <div className="text-muted-foreground text-sm">
          <p>Panel content will appear here.</p>
          <p className="mt-2 text-xs text-muted-foreground/60">Type: {activePanel}</p>
        </div>
      </SlideInPanel>

      <ConfirmModal />
      <ToastSystem />
    </div>
  )
}
