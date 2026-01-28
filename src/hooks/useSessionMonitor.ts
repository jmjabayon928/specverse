import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type SessionMonitorOptions = {
  timeoutMinutes?: number
  warningDuration?: number
}

export function useSessionMonitor(
  options: SessionMonitorOptions = {}
) {
  const {
    timeoutMinutes = 30,
    warningDuration = 30,
  } = options

  const router = useRouter()

  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(warningDuration)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }, [router])

  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)

    let timeLeft = warningDuration
    setCountdown(timeLeft)

    countdownRef.current = setInterval(() => {
      timeLeft -= 1
      setCountdown(timeLeft)

      if (timeLeft <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        logout()
      }
    }, 1000)
  }, [logout, warningDuration])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)

    setShowWarning(false)
    setCountdown(warningDuration)

    timerRef.current = setTimeout(() => {
      setShowWarning(true)
      startCountdown()
    }, timeoutMinutes * 60 * 1000)
  }, [timeoutMinutes, warningDuration, startCountdown])

  useEffect(() => {
    resetTimer()

    const events = ['mousemove', 'keydown', 'click'] as const

    const handleActivity = () => {
      resetTimer()
    }

    for (const event of events) {
      globalThis.addEventListener(event, handleActivity)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)

      for (const event of events) {
        globalThis.removeEventListener(event, handleActivity)
      }
    }
  }, [resetTimer])

  return {
    showWarning,
    countdown,
    stayLoggedIn: resetTimer,
    logout,
  }
}
