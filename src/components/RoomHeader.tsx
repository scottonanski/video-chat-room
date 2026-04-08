import { Crown, Users, Wifi, WifiOff, Loader2, Sun, Moon, Link, Monitor, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import type { ConnectionStatus } from '@/hooks/useSignaling'
import type { Theme } from '@/App'

interface RoomHeaderProps {
  isAdmin: boolean
  connectionStatus: ConnectionStatus
  participantCount: number
  theme: Theme
  onToggleTheme: () => void
  isTouch: boolean
  onToggleLayout: () => void
}

export default function RoomHeader({ isAdmin, connectionStatus, participantCount, theme, onToggleTheme, isTouch, onToggleLayout }: RoomHeaderProps) {
  const isConnected = connectionStatus === 'connected'
  const isPending = connectionStatus === 'connecting' || connectionStatus === 'reconnecting'

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-lg font-semibold">
          <span className="hidden sm:inline">Video Chat Room</span>
          <span className="sm:hidden">VCR</span>
        </h1>
        {isAdmin && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <Crown className="h-3 w-3" />
            Admin
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <span className="hidden sm:inline">{isConnected ? 'Connected' : isPending ? 'Connecting...' : 'Disconnected'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span>{participantCount}</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.origin)
            toast.success('Invite link copied!')
          }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          title="Copy invite link"
        >
          <Link className="h-4 w-4" />
        </button>
        {window.screen.width >= 1400 && (
          <button
            onClick={onToggleLayout}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title={isTouch ? 'Switch to desktop layout' : 'Switch to touch layout'}
          >
            {isTouch ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          </button>
        )}
        <button
          onClick={onToggleTheme}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  )
}
