import { useEffect, useRef } from 'react'
import { Crown, User, MicOff, VideoOff, UserX, Hand, Clock } from 'lucide-react'
import type { Peer } from '@/hooks/usePeerConnections'
import { cn } from '@/lib/utils'

interface ParticipantStripProps {
  userName: string
  isAdmin: boolean
  isScreenSharing: boolean
  localStream: MediaStream | null
  peers: Record<string, Peer>
  myStatus: string | null
  onSelectLocal: () => void
  onSelectPeer: (peerId: string, peerName: string) => void
  onMutePeer: (peerId: string) => void
  onTurnOffPeerCamera: (peerId: string) => void
  onKickPeer: (peerId: string) => void
}

function StatusOverlay({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <div className="absolute top-1 left-1 z-10 rounded bg-black/60 p-1">
      {status === 'hand' && <Hand className="h-4 w-4 text-amber-400" />}
      {status === 'brb' && <Clock className="h-4 w-4 text-blue-400" />}
    </div>
  )
}

function LocalTile({
  userName,
  isAdmin,
  isScreenSharing,
  localStream,
  myStatus,
  onSelect,
}: {
  userName: string
  isAdmin: boolean
  isScreenSharing: boolean
  localStream: MediaStream | null
  myStatus: string | null
  onSelect: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream
    }
  }, [localStream])

  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative aspect-video w-32 sm:w-48 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-border bg-muted transition-colors hover:border-primary',
        isAdmin && 'border-primary/50',
      )}
    >
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
      <StatusOverlay status={myStatus} />
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 bg-black/60 px-2 py-1 text-xs text-white">
        {isAdmin && <Crown className="h-3 w-3 text-primary" />}
        <span className="truncate">{isScreenSharing ? `${userName} (Screen)` : `${userName} (You)`}</span>
        {isAdmin ? (
          <span className="ml-auto rounded bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">Admin</span>
        ) : (
          <span className="ml-auto flex items-center gap-0.5 rounded bg-emerald-600/80 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"><User className="h-2.5 w-2.5" />Participant</span>
        )}
      </div>
    </button>
  )
}

function PeerTile({
  peer,
  isAdmin,
  onSelect,
  onMute,
  onCameraOff,
  onKick,
}: {
  peer: Peer
  isAdmin: boolean
  onSelect: () => void
  onMute: () => void
  onCameraOff: () => void
  onKick: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream
    }
  }, [peer.stream])

  return (
    <div
      className={cn(
        'group relative aspect-video w-32 sm:w-48 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-border bg-muted transition-colors hover:border-primary',
        peer.isAdmin && 'border-primary/50',
      )}
      onClick={onSelect}
    >
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 bg-black/60 px-2 py-1 text-xs text-white">
        {peer.isAdmin && <Crown className="h-3 w-3 text-primary" />}
        <span className="truncate">{peer.name}</span>
        {peer.isAdmin ? (
          <span className="ml-auto rounded bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">Admin</span>
        ) : (
          <span className="ml-auto flex items-center gap-0.5 rounded bg-emerald-600/80 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"><User className="h-2.5 w-2.5" />Participant</span>
        )}
      </div>

      <StatusOverlay status={peer.status} />

      {peer.quality && (
        <span
          className={cn(
            'absolute bottom-8 right-2 h-2.5 w-2.5 rounded-full border border-black/40',
            peer.quality === 'good' && 'bg-green-500',
            peer.quality === 'fair' && 'bg-yellow-500',
            peer.quality === 'poor' && 'bg-red-500',
          )}
          title={`Connection: ${peer.quality}`}
        />
      )}

      {isAdmin && (
        <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
          <button
            onClick={(e) => { e.stopPropagation(); onMute() }}
            className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
            title="Mute"
          >
            <MicOff className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCameraOff() }}
            className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
            title="Camera off"
          >
            <VideoOff className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onKick() }}
            className="rounded bg-destructive/80 p-1 text-white hover:bg-destructive"
            title="Kick"
          >
            <UserX className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function ParticipantStrip({
  userName,
  isAdmin,
  isScreenSharing,
  localStream,
  peers,
  myStatus,
  onSelectLocal,
  onSelectPeer,
  onMutePeer,
  onTurnOffPeerCamera,
  onKickPeer,
}: ParticipantStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border bg-card/50 p-2">
      <LocalTile
        userName={userName}
        isAdmin={isAdmin}
        isScreenSharing={isScreenSharing}
        localStream={localStream}
        myStatus={myStatus}
        onSelect={onSelectLocal}
      />

      {Object.entries(peers).map(([peerId, peer]) => (
        <PeerTile
          key={peerId}
          peer={peer}
          isAdmin={isAdmin}
          onSelect={() => onSelectPeer(peerId, peer.name)}
          onMute={() => onMutePeer(peerId)}
          onCameraOff={() => onTurnOffPeerCamera(peerId)}
          onKick={() => onKickPeer(peerId)}
        />
      ))}
    </div>
  )
}
