import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useSessionMonitor({
  timeoutMinutes = 30,
  warningDuration = 30, // seconds
}: {
  timeoutMinutes?: number;
  warningDuration?: number;
}) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(warningDuration);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowWarning(false);
    setCountdown(warningDuration);

    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      let timeLeft = warningDuration;

      countdownRef.current = setInterval(() => {
        timeLeft -= 1;
        setCountdown(timeLeft);

        if (timeLeft <= 0) {
          clearInterval(countdownRef.current!);
          logout();
        }
      }, 1000);
    }, timeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    resetTimer();

    const events = ["mousemove", "keydown", "click"];
    const handleActivity = () => resetTimer();

    events.forEach((event) => window.addEventListener(event, handleActivity));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, []);

  return {
    showWarning,
    countdown,
    stayLoggedIn: resetTimer,
    logout,
  };
}
