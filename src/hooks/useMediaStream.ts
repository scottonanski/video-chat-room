import { useRef, useState, useCallback } from 'react'

export interface MediaDeviceInfo_ {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

export function useMediaStream() {
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo_[]>([])
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('')
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('')

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices()
    setDevices(
      all
        .filter((d) => d.deviceId && d.label)
        .map((d) => ({ deviceId: d.deviceId, label: d.label, kind: d.kind })),
    )
  }, [])

  const startMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
    })
    localStreamRef.current = stream
    setLocalStream(stream)
    await refreshDevices()
    return stream
  }, [refreshDevices])

  const switchDevice = useCallback(
    async (kind: 'audioinput' | 'videoinput', deviceId: string) => {
      const isAudio = kind === 'audioinput'
      if (isAudio) setSelectedAudioDeviceId(deviceId)
      else setSelectedVideoDeviceId(deviceId)

      const constraints = isAudio
        ? { audio: { deviceId: { exact: deviceId }, noiseSuppression: true, echoCancellation: true, autoGainControl: true }, video: false }
        : { audio: false, video: { deviceId: { exact: deviceId }, width: 1280, height: 720 } }

      const tmpStream = await navigator.mediaDevices.getUserMedia(constraints)
      const newTrack = isAudio ? tmpStream.getAudioTracks()[0] : tmpStream.getVideoTracks()[0]

      const stream = localStreamRef.current
      if (stream) {
        const oldTrack = isAudio ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0]
        if (oldTrack) {
          oldTrack.stop()
          stream.removeTrack(oldTrack)
        }
        stream.addTrack(newTrack)
      }

      return newTrack
    },
    [],
  )

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsMuted(!audioTrack.enabled)
    }
  }, [])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsCameraOff(!videoTrack.enabled)
    }
  }, [])

  const startScreenShare = useCallback(async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: 1920, height: 1080 },
      audio: false,
    })
    screenStreamRef.current = screenStream
    setIsScreenSharing(true)
    return screenStream
  }, [])

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
    }
    setIsScreenSharing(false)
  }, [])

  const stopAllMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    setLocalStream(null)
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
    }
  }, [])

  return {
    localStreamRef,
    screenStreamRef,
    localStream,
    isMuted,
    setIsMuted,
    isCameraOff,
    setIsCameraOff,
    isScreenSharing,
    devices,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    startMedia,
    switchDevice,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    stopAllMedia,
  }
}
