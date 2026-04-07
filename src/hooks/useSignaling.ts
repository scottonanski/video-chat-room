import { useRef, useState, useCallback } from 'react'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface SignalingMessage {
  type: string
  [key: string]: unknown
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001').replace(/\/$/, '')
const WS_URL = BACKEND_URL.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')

export { BACKEND_URL }

export function useSignaling(
  userName: string,
  onMessage: (msg: SignalingMessage) => void,
  onReconnect?: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const myPeerIdRef = useRef<string | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnectRef = useRef(true)
  const wasReconnectingRef = useRef(false)
  const onReconnectRef = useRef(onReconnect)
  onReconnectRef.current = onReconnect
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  const generatePeerId = () => 'peer_' + Math.random().toString(36).substr(2, 9)

  const send = useCallback((msg: SignalingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const connect = useCallback(() => {
    const peerId = myPeerIdRef.current || generatePeerId()
    myPeerIdRef.current = peerId
    shouldReconnectRef.current = true
    setConnectionStatus(wsRef.current ? 'reconnecting' : 'connecting')

    const wsUrl = `${WS_URL}/ws/${peerId}?name=${encodeURIComponent(userName)}`
    const websocket = new WebSocket(wsUrl)
    wsRef.current = websocket

    websocket.onopen = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wasReconnectingRef.current) {
        wasReconnectingRef.current = false
        onReconnectRef.current?.()
      }
      setConnectionStatus('connected')
    }

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      onMessage(message)
    }

    websocket.onclose = () => {
      wsRef.current = null
      if (!shouldReconnectRef.current) {
        setConnectionStatus('disconnected')
        return
      }
      setConnectionStatus('reconnecting')
      wasReconnectingRef.current = true
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 2000)
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }, [userName, onMessage])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionStatus('disconnected')
  }, [])

  return {
    connectionStatus,
    myPeerIdRef,
    send,
    connect,
    disconnect,
  }
}
