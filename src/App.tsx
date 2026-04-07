import { useState, useEffect, useCallback } from 'react'
import LandingPage from '@/components/LandingPage'
import VideoRoom from '@/components/VideoRoom'

export type Theme = 'dark' | 'light'

export default function App() {
  const [userName, setUserName] = useState('')
  const [joined, setJoined] = useState(false)
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'dark',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  const handleJoin = (name: string) => {
    setUserName(name)
    setJoined(true)
  }

  const handleLeave = () => {
    setJoined(false)
    setUserName('')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!joined ? (
        <LandingPage onJoin={handleJoin} theme={theme} onToggleTheme={toggleTheme} />
      ) : (
        <VideoRoom userName={userName} onLeave={handleLeave} theme={theme} onToggleTheme={toggleTheme} />
      )}
    </div>
  )
}
