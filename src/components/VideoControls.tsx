import { useState } from 'react'
import { Mic, MicOff, Camera, CameraOff, MonitorUp, MonitorOff, LogOut, Settings, Radio, Hand, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MediaDeviceInfo_ } from '@/hooks/useMediaStream'

interface VideoControlsProps {
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  onToggleMute: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onLeave: () => void
  isPTTMode: boolean
  onTogglePTTMode: () => void
  devices: MediaDeviceInfo_[]
  selectedAudioDeviceId: string
  selectedVideoDeviceId: string
  onSwitchDevice: (kind: 'audioinput' | 'videoinput', deviceId: string) => void
  myStatus: string | null
  onSetStatus: (status: string | null) => void
}

export default function VideoControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  isPTTMode,
  onTogglePTTMode,
  devices,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onSwitchDevice,
  myStatus,
  onSetStatus,
}: VideoControlsProps) {
  const [showSettings, setShowSettings] = useState(false)

  const audioDevices = devices.filter((d) => d.kind === 'audioinput')
  const videoDevices = devices.filter((d) => d.kind === 'videoinput')

  return (
    <div className="relative flex items-center justify-center gap-3 py-2">
      <Button
        variant={isMuted ? 'destructive' : 'secondary'}
        size="icon"
        onClick={isPTTMode ? undefined : onToggleMute}
        title={isPTTMode ? 'Hold Space to talk' : isMuted ? 'Unmute' : 'Mute'}
        className={cn(
          'h-12 w-12 rounded-full',
          isPTTMode && 'cursor-default',
          isPTTMode && !isMuted && 'bg-emerald-600 text-white hover:bg-emerald-600',
        )}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>

      <Button
        variant={isPTTMode ? 'default' : 'secondary'}
        size="icon"
        onClick={onTogglePTTMode}
        title={isPTTMode ? 'Disable push-to-talk' : 'Enable push-to-talk'}
        className={cn('h-12 w-12 rounded-full')}
      >
        <Radio className="h-5 w-5" />
      </Button>

      <Button
        variant={isCameraOff ? 'destructive' : 'secondary'}
        size="icon"
        onClick={onToggleCamera}
        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        className={cn('h-12 w-12 rounded-full')}
      >
        {isCameraOff ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
      </Button>

      <Button
        variant={isScreenSharing ? 'default' : 'secondary'}
        size="icon"
        onClick={onToggleScreenShare}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        className={cn('h-12 w-12 rounded-full')}
      >
        {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
      </Button>

      <Button
        variant={myStatus === 'hand' ? 'default' : 'secondary'}
        size="icon"
        onClick={() => onSetStatus(myStatus === 'hand' ? null : 'hand')}
        title={myStatus === 'hand' ? 'Lower hand' : 'Raise hand'}
        className={cn('h-12 w-12 rounded-full', myStatus === 'hand' && 'bg-amber-500 text-white hover:bg-amber-600')}
      >
        <Hand className="h-5 w-5" />
      </Button>

      <Button
        variant={myStatus === 'brb' ? 'default' : 'secondary'}
        size="icon"
        onClick={() => onSetStatus(myStatus === 'brb' ? null : 'brb')}
        title={myStatus === 'brb' ? 'Back' : 'Be right back'}
        className={cn('h-12 w-12 rounded-full', myStatus === 'brb' && 'bg-blue-500 text-white hover:bg-blue-600')}
      >
        <Clock className="h-5 w-5" />
      </Button>

      <div className="relative">
        {showSettings && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg space-y-3">
            {audioDevices.length > 0 && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Microphone</label>
                <select
                  value={selectedAudioDeviceId}
                  onChange={(e) => onSwitchDevice('audioinput', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                >
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}
            {videoDevices.length > 0 && (
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Camera</label>
                <select
                  value={selectedVideoDeviceId}
                  onChange={(e) => onSwitchDevice('videoinput', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                >
                  {videoDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setShowSettings((v) => !v)}
          title="Device settings"
          className={cn('h-12 w-12 rounded-full')}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <Button
        variant="destructive"
        size="icon"
        onClick={onLeave}
        title="Leave room"
        className={cn('h-12 w-12 rounded-full')}
      >
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  )
}
