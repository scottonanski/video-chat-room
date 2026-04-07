import { useState, type FormEvent } from 'react'
import { Video, Sun, Moon } from 'lucide-react'
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
    <div className="relative flex min-h-screen items-center justify-center p-4">
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
    </div>
  )
}
