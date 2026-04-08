import { useState, useCallback } from 'react'

function detectTouch(): boolean {
  const coarsePointer =
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(any-pointer: coarse)').matches
  const hasTouch = navigator.maxTouchPoints > 0
  const isWideEnoughForDesktop = window.screen.width >= 1400

  // Only treat as desktop if NONE of the touch signals fire AND screen is wide
  if (!coarsePointer && !hasTouch && isWideEnoughForDesktop) return false
  return true
}

function getStoredLayout(): boolean {
  const stored = localStorage.getItem('layoutMode')
  if (stored === 'touch') return true
  if (stored === 'desktop') return false
  return detectTouch()
}

export function useIsTouch(): [boolean, () => void] {
  const [isTouch, setIsTouch] = useState(() => getStoredLayout())

  const toggle = useCallback(() => {
    setIsTouch((prev) => {
      const next = !prev
      localStorage.setItem('layoutMode', next ? 'touch' : 'desktop')
      return next
    })
  }, [])

  return [isTouch, toggle]
}
