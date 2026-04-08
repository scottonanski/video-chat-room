import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { useIsTouch } from '@/hooks/useIsTouch'
import { toast } from 'sonner'
import { useMediaStream } from '@/hooks/useMediaStream'
import { useSignaling, BACKEND_URL } from '@/hooks/useSignaling'
import { usePeerConnections } from '@/hooks/usePeerConnections'
import RoomHeader from '@/components/RoomHeader'
import ParticipantStrip from '@/components/ParticipantStrip'
import MainStage, { type MainVideoState } from '@/components/MainStage'
import VideoControls from '@/components/VideoControls'
import ChatPanel, { type ChatMessage } from '@/components/ChatPanel'
import { Toaster } from '@/components/ui/sonner'
import type { Theme } from '@/App'

interface VideoRoomProps {
  userName: string
  onLeave: () => void
  theme: Theme
  onToggleTheme: () => void
}

export default function VideoRoom({ userName, onLeave, theme, onToggleTheme }: VideoRoomProps) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [mainVideo, setMainVideo] = useState<MainVideoState>({
    peerId: 'local',
    name: userName,
  })
  const [unreadCount, setUnreadCount] = useState(0)
  const resetUnread = useCallback(() => setUnreadCount(0), [])
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isPTTMode, setIsPTTMode] = useState(false)
  const [isTouch, toggleLayout] = useIsTouch()
  const [myStatus, setMyStatus] = useState<string | null>(null)

  const media = useMediaStream()

  const handleSignalingMessage = useCallback(
    async (message: Record<string, unknown>) => {
      const type = message.type as string

      switch (type) {
        case 'peer-list': {
          setIsAdmin(Boolean(message.isAdmin))
          const peerList = message.peers as Array<{
            peerId: string
            name: string
            isAdmin: boolean
          }>
          peers.setPeers((prev) => {
            const updated = { ...prev }
            for (const peer of peerList) {
              updated[peer.peerId] = {
                ...updated[peer.peerId],
                name: peer.name,
                isAdmin: peer.isAdmin,
                stream: updated[peer.peerId]?.stream || null,
                quality: updated[peer.peerId]?.quality ?? null,
                status: updated[peer.peerId]?.status ?? null,
              }
            }
            return updated
          })
          for (const peer of peerList) {
            await peers.createPeerConnection(peer.peerId, peer.name, true, peer.isAdmin)
          }
          break
        }

        case 'peer-joined': {
          const peerId = message.peerId as string
          const name = message.name as string
          const peerIsAdmin = message.isAdmin as boolean
          toast.success(`${name} joined`)
          await peers.createPeerConnection(peerId, name, false, peerIsAdmin)
          break
        }

        case 'admin-changed': {
          const adminId = message.adminId as string
          setIsAdmin(adminId === signaling.myPeerIdRef.current)
          peers.updatePeerAdmin(adminId)
          break
        }

        case 'offer':
          await peers.handleOffer(
            message.fromPeerId as string,
            message.offer as RTCSessionDescriptionInit,
          )
          break

        case 'answer':
          await peers.handleAnswer(
            message.fromPeerId as string,
            message.answer as RTCSessionDescriptionInit,
          )
          break

        case 'ice-candidate':
          await peers.handleIceCandidate(
            message.fromPeerId as string,
            message.candidate as RTCIceCandidateInit,
          )
          break

        case 'peer-left': {
          const leftPeerId = message.peerId as string
          const leftName = peers.peers[leftPeerId]?.name || 'Someone'
          toast.warning(`${leftName} left`)
          peers.removePeer(leftPeerId)
          if (mainVideo.peerId === leftPeerId) {
            setMainVideo({ peerId: 'local', name: userName })
          }
          break
        }

        case 'chat': {
          const senderName = message.senderName as string
          setMessages((prev) => [
            ...prev,
            {
              sender_name: senderName,
              message: message.message as string,
              timestamp: message.timestamp as string,
            },
          ])
          if (senderName !== userName) {
            setUnreadCount((c) => c + 1)
          }
          break
        }

        case 'kicked':
          toast.error('You have been removed from the room by the admin')
          handleLeave()
          break

        case 'status': {
          const statusPeerId = message.peerId as string
          const newStatus = (message.status as string) || null
          if (statusPeerId === signaling.myPeerIdRef.current) {
            setMyStatus(newStatus)
          } else {
            peers.setPeers((prev) => ({
              ...prev,
              [statusPeerId]: prev[statusPeerId] ? { ...prev[statusPeerId], status: newStatus } : prev[statusPeerId],
            }))
          }
          break
        }

        case 'mute-request':
          media.setIsMuted(true)
          if (media.localStreamRef.current) {
            media.localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false))
          }
          break

        case 'camera-off-request':
          media.setIsCameraOff(true)
          if (media.localStreamRef.current) {
            media.localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = false))
          }
          break
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userName, mainVideo.peerId],
  )

  const signaling = useSignaling(userName, handleSignalingMessage, () => {
    peersRef.current.closeAll()
    toast.success('Reconnected successfully')
  })
  const peers = usePeerConnections(media.localStreamRef, signaling.send)
  const peersRef = useRef(peers)
  peersRef.current = peers


  useEffect(() => {
    if (!isPTTMode) return

    const isInputFocused = () => {
      const tag = document.activeElement?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isInputFocused()) return
      e.preventDefault()
      const track = media.localStreamRef.current?.getAudioTracks()[0]
      if (track) track.enabled = true
      media.setIsMuted(false)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isInputFocused()) return
      e.preventDefault()
      const track = media.localStreamRef.current?.getAudioTracks()[0]
      if (track) track.enabled = false
      media.setIsMuted(true)
    }

    // Mute immediately when entering PTT mode
    const track = media.localStreamRef.current?.getAudioTracks()[0]
    if (track) track.enabled = false
    media.setIsMuted(true)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      // Restore mic when leaving PTT mode
      const t = media.localStreamRef.current?.getAudioTracks()[0]
      if (t) t.enabled = true
      media.setIsMuted(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPTTMode])

  useEffect(() => {
    const init = async () => {
      try {
        await media.startMedia()
        signaling.connect()
        loadChatHistory()
      } catch (error) {
        console.error('Error accessing media:', error)
        toast.error('Failed to access camera/microphone. Please check permissions.')
      }
    }
    init()

    return () => {
      media.stopAllMedia()
      peers.closeAll()
      signaling.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/messages?limit=50`)
      const data = await response.json()
      if (data.messages?.length) {
        setMessages((prev) => [...data.messages, ...prev])
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const sendChatMessage = (e: FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    signaling.send({ type: 'chat', message: chatInput.trim() })
    setChatInput('')
  }

  const toggleScreenShare = async () => {
    if (!media.isScreenSharing) {
      try {
        const screenStream = await media.startScreenShare()
        const screenTrack = screenStream.getVideoTracks()[0]
        await peers.replaceVideoTrack(screenTrack)
        setMainVideo({ peerId: 'local', name: `${userName} (Screen)` })
        screenTrack.onended = async () => {
          media.stopScreenShare()
          const videoTrack = media.localStreamRef.current?.getVideoTracks()[0]
          if (videoTrack) await peers.replaceVideoTrack(videoTrack)
          if (mainVideo.peerId === 'local') {
            setMainVideo({ peerId: 'local', name: userName })
          }
        }
      } catch (error: unknown) {
        const err = error as DOMException
        if (err.name === 'NotAllowedError') {
          console.log('Screen share cancelled by user')
        } else {
          console.error('Error starting screen share:', err.name, err.message)
        }
      }
    } else {
      media.stopScreenShare()
      const videoTrack = media.localStreamRef.current?.getVideoTracks()[0]
      if (videoTrack) await peers.replaceVideoTrack(videoTrack)
      if (mainVideo.peerId === 'local') {
        setMainVideo({ peerId: 'local', name: userName })
      }
    }
  }

  const showLocalOnMainStage = () => {
    setMainVideo({
      peerId: 'local',
      name: media.isScreenSharing ? `${userName} (Screen)` : userName,
    })
  }

  const showPeerOnMainStage = (peerId: string, peerName: string) => {
    setMainVideo({ peerId, name: peerName })
  }

  const kickPeer = (peerId: string) => {
    if (!isAdmin) return
    signaling.send({ type: 'kick', targetPeerId: peerId })
  }

  const mutePeer = (peerId: string) => {
    if (!isAdmin) return
    signaling.send({ type: 'mute', targetPeerId: peerId })
  }

  const turnOffPeerCamera = (peerId: string) => {
    if (!isAdmin) return
    signaling.send({ type: 'camera-off', targetPeerId: peerId })
  }

  const handleLeave = () => {
    media.stopAllMedia()
    peers.closeAll()
    signaling.disconnect()
    onLeave()
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <RoomHeader
        isAdmin={isAdmin}
        connectionStatus={signaling.connectionStatus}
        participantCount={Object.keys(peers.peers).length + 1}
        theme={theme}
        onToggleTheme={onToggleTheme}
        isTouch={isTouch}
        onToggleLayout={toggleLayout}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col">
          <ParticipantStrip
            userName={userName}
            isAdmin={isAdmin}
            isScreenSharing={media.isScreenSharing}
            localStream={media.localStream}
            peers={peers.peers}
            myStatus={myStatus}
            onSelectLocal={showLocalOnMainStage}
            onSelectPeer={showPeerOnMainStage}
            onMutePeer={mutePeer}
            onTurnOffPeerCamera={turnOffPeerCamera}
            onKickPeer={kickPeer}
          />

          <div className="relative min-h-0 flex-1 p-2 pt-0">
            <MainStage
              mainVideo={mainVideo}
              localStream={media.localStream}
              screenStream={media.screenStreamRef.current}
              isScreenSharing={media.isScreenSharing}
              peers={peers.peers}
            />
            <Toaster
              position="bottom-center"
              richColors
              style={{ position: 'absolute' }}
            />
          </div>

          <VideoControls
            isMuted={media.isMuted}
            isCameraOff={media.isCameraOff}
            isScreenSharing={media.isScreenSharing}
            onToggleMute={media.toggleMute}
            onToggleCamera={media.toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onLeave={handleLeave}
            isPTTMode={isPTTMode}
            onTogglePTTMode={() => setIsPTTMode((v) => !v)}
            myStatus={myStatus}
            unreadCount={unreadCount}
            isTouch={isTouch}
            onToggleChat={() => setIsChatOpen((v) => !v)}
            onSetStatus={(status) => {
              setMyStatus(status)
              signaling.send({ type: 'status', status })
              if (status === 'brb') {
                media.setIsCameraOff(true)
                media.localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = false))
              } else if (myStatus === 'brb') {
                media.setIsCameraOff(false)
                media.localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = true))
              }
            }}
            devices={media.devices}
            selectedAudioDeviceId={media.selectedAudioDeviceId}
            selectedVideoDeviceId={media.selectedVideoDeviceId}
            onSwitchDevice={async (kind, deviceId) => {
              const newTrack = await media.switchDevice(kind, deviceId)
              if (kind === 'videoinput') {
                await peers.replaceVideoTrack(newTrack)
              } else {
                await peers.replaceAudioTrack(newTrack)
              }
            }}
          />
        </div>

        <ChatPanel
          currentUser={userName}
          messages={messages}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onSendChatMessage={sendChatMessage}
          onSendEmoji={(emoji) => signaling.send({ type: 'chat', message: emoji })}
          unreadCount={unreadCount}
          onResetUnread={resetUnread}
          isTouch={isTouch}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </div>
    </div>
  )
}
