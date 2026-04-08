import { useEffect, useRef, useState, useCallback } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

export interface MainVideoState {
  peerId: string
  name: string
}

interface MainStageProps {
  mainVideo: MainVideoState
  localStream: MediaStream | null
  screenStream: MediaStream | null
  isScreenSharing: boolean
  peers: Record<string, { stream: MediaStream | null }>
}

export default function MainStage({
  mainVideo,
  localStream,
  screenStream,
  isScreenSharing,
  peers,
}: MainStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const selfVideoRef = useRef<HTMLVideoElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (containerRef.current) {
        await containerRef.current.requestFullscreen()
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!videoRef.current) return

    if (mainVideo.peerId === 'local') {
      videoRef.current.srcObject = isScreenSharing
        ? screenStream
        : localStream
    } else {
      videoRef.current.srcObject = peers[mainVideo.peerId]?.stream || null
    }
  }, [mainVideo, peers, isScreenSharing, localStream, screenStream])

  const isViewingPeer = mainVideo.peerId !== 'local'

  useEffect(() => {
    if (selfVideoRef.current && isViewingPeer && localStream) {
      selfVideoRef.current.srcObject = localStream
    }
  }, [isViewingPeer, localStream])

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-black">
      <div className="relative aspect-video h-full max-w-full overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={mainVideo.peerId === 'local'}
          className="h-full w-full object-cover"
        />

        <div className="absolute bottom-3 left-3 rounded-md bg-black/60 px-3 py-1 text-sm text-white">
          {mainVideo.name}
        </div>

        <button
          onClick={toggleFullscreen}
          className="absolute bottom-3 right-3 rounded-md bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {isViewingPeer && (
          <div className="absolute top-3 right-3 z-10 w-24 sm:w-40 aspect-video overflow-hidden rounded-lg border-2 border-white/20 shadow-2xl bg-black">
            <video
              ref={selfVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-0.5 text-[11px] text-white">
              You
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
