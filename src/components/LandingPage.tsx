import { useState, type FormEvent } from 'react'
import { Video, Sun, Moon, Coffee } from 'lucide-react'
import type { Theme } from '@/App'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface LandingPageProps {
  onJoin: (name: string) => void
  theme: Theme
  onToggleTheme: () => void
}

export default function LandingPage({ onJoin, theme, onToggleTheme }: LandingPageProps) {
  const [name, setName] = useState(() => localStorage.getItem('userName') || '')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      localStorage.setItem('userName', name.trim())
      onJoin(name.trim())
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      <button
        onClick={onToggleTheme}
        className="absolute top-4 right-4 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-heading text-2xl">Video Chat Room</CardTitle>
          <CardDescription>Enter your name to join the room</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit" disabled={!name.trim()} className="w-full">
              Join Room
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 transition-all hover:scale-105 active:scale-95">
        <a
          href="https://buymeacoffee.com/d0qtanhk43"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-1.5"
          title="Your support helps keep this project maintained and free for everyone."
        >
          <div className="flex items-center gap-2 rounded-full bg-[#FFDD00]/10 px-4 py-2 text-[#FFDD00] transition-colors group-hover:bg-[#FFDD00]/20">
            <Coffee className="h-4 w-4 fill-current" />
            <span className="text-xs font-bold uppercase tracking-wider">buy me a coffee</span>
            <Coffee className="h-4 w-4 fill-current" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
            Your support helps keep this project free.
          </span>
        </a>
      </div>
    </div>
  )
}
