import { useRef, useState, useCallback } from 'react'
import type { SignalingMessage } from './useSignaling'

export type ConnectionQuality = 'good' | 'fair' | 'poor' | null

export interface Peer {
  name: string
  stream: MediaStream | null
  isAdmin: boolean
  quality: ConnectionQuality
  status: string | null
}

const STUN_SERVERS = [
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export function usePeerConnections(
  localStreamRef: React.RefObject<MediaStream | null>,
  send: (msg: SignalingMessage) => void,
) {
  const peerConnectionsRef = useRef<
    Record<string, { pc: RTCPeerConnection; name: string; isAdmin: boolean; statsInterval?: ReturnType<typeof setInterval> }>
  >({})
  const disconnectTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [peers, setPeers] = useState<Record<string, Peer>>({})

  const createPeerConnection = useCallback(
    async (peerId: string, peerName: string, shouldCreateOffer: boolean, isPeerAdmin: boolean) => {
      if (peerConnectionsRef.current[peerId]) return

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })
      peerConnectionsRef.current[peerId] = { pc, name: peerName, isAdmin: isPeerAdmin }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!)
        })
      }

      pc.ontrack = (event) => {
        setPeers((prev) => ({
          ...prev,
          [peerId]: {
            name: peerName,
            stream: event.streams[0],
            isAdmin: isPeerAdmin,
            quality: prev[peerId]?.quality ?? null,
            status: prev[peerId]?.status ?? null,
          },
        }))
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({
            type: 'ice-candidate',
            targetPeerId: peerId,
            candidate: event.candidate,
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          if (disconnectTimeoutsRef.current[peerId]) {
            clearTimeout(disconnectTimeoutsRef.current[peerId])
            delete disconnectTimeoutsRef.current[peerId]
          }
        } else if (pc.connectionState === 'failed') {
          removePeer(peerId)
        } else if (pc.connectionState === 'disconnected') {
          disconnectTimeoutsRef.current[peerId] = setTimeout(() => {
            delete disconnectTimeoutsRef.current[peerId]
            removePeer(peerId)
          }, 5000)
        }
      }

      const statsInterval = setInterval(async () => {
        try {
          const stats = await pc.getStats()
          let rtt: number | null = null
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime != null) {
              rtt = report.currentRoundTripTime * 1000
            }
          })
          if (rtt !== null) {
            const quality: ConnectionQuality = rtt < 150 ? 'good' : rtt < 400 ? 'fair' : 'poor'
            setPeers((prev) => {
              if (!prev[peerId]) return prev
              if (prev[peerId].quality === quality) return prev
              return { ...prev, [peerId]: { ...prev[peerId], quality } }
            })
          }
        } catch {
          // peer connection may have closed
        }
      }, 3000)
      peerConnectionsRef.current[peerId].statsInterval = statsInterval

      if (shouldCreateOffer) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        send({
          type: 'offer',
          targetPeerId: peerId,
          offer,
        })
      }
    },
    [localStreamRef, send],
  )

  const handleOffer = useCallback(
    async (peerId: string, offer: RTCSessionDescriptionInit) => {
      const peerData = peerConnectionsRef.current[peerId]
      if (!peerData) return

      await peerData.pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peerData.pc.createAnswer()
      await peerData.pc.setLocalDescription(answer)

      send({
        type: 'answer',
        targetPeerId: peerId,
        answer,
      })
    },
    [send],
  )

  const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
    const peerData = peerConnectionsRef.current[peerId]
    if (!peerData) return
    await peerData.pc.setRemoteDescription(new RTCSessionDescription(answer))
  }, [])

  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    const peerData = peerConnectionsRef.current[peerId]
    if (!peerData) return
    try {
      await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (error) {
      console.error('Error adding ICE candidate:', error)
    }
  }, [])

  const removePeer = useCallback((peerId: string) => {
    if (peerConnectionsRef.current[peerId]) {
      clearInterval(peerConnectionsRef.current[peerId].statsInterval)
      peerConnectionsRef.current[peerId].pc.close()
      delete peerConnectionsRef.current[peerId]
    }
    setPeers((prev) => {
      const next = { ...prev }
      delete next[peerId]
      return next
    })
  }, [])

  const updatePeerAdmin = useCallback((adminId: string) => {
    setPeers((prev) => {
      const next: Record<string, Peer> = {}
      for (const [id, peer] of Object.entries(prev)) {
        next[id] = { ...peer, isAdmin: id === adminId }
      }
      return next
    })
  }, [])

  const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack) => {
    for (const peerId in peerConnectionsRef.current) {
      const sender = peerConnectionsRef.current[peerId].pc
        .getSenders()
        .find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(newTrack)
      }
    }
  }, [])

  const replaceAudioTrack = useCallback(async (newTrack: MediaStreamTrack) => {
    for (const peerId in peerConnectionsRef.current) {
      const sender = peerConnectionsRef.current[peerId].pc
        .getSenders()
        .find((s) => s.track?.kind === 'audio')
      if (sender) {
        await sender.replaceTrack(newTrack)
      }
    }
  }, [])

  const closeAll = useCallback(() => {
    for (const peerId in peerConnectionsRef.current) {
      clearInterval(peerConnectionsRef.current[peerId].statsInterval)
      peerConnectionsRef.current[peerId].pc.close()
    }
    peerConnectionsRef.current = {}
    setPeers({})
  }, [])

  return {
    peers,
    setPeers,
    peerConnectionsRef,
    createPeerConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    updatePeerAdmin,
    replaceVideoTrack,
    replaceAudioTrack,
    closeAll,
  }
}
