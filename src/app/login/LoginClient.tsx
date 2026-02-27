'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type LoginResponse = {
  token?: string
  user?: unknown
  message?: string
  error?: string
}

const isLoginResponse = (value: unknown): value is LoginResponse => {
  if (typeof value !== 'object' || value === null) return false
  return true
}

import Checkbox from '@/components/form/input/Checkbox'
import Input from '@/components/form/input/InputField'
import Label from '@/components/form/Label'
import Button from '@/components/ui/button/Button'
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from '@/icons'
import Link from 'next/link'
import { useSession } from '@/hooks/useSession'

const getReasonMessage = (reason: string): string | null => {
  if (reason === 'missing_token') {
    return 'Your session cookie was missing. Please sign in again.'
  }
  if (reason === 'session_non_ok') {
    return 'Your session was rejected by the server. Please sign in again.'
  }
  if (reason === 'session_401') {
    return 'Your session expired. Please sign in again.'
  }
  if (reason === 'session_fetch_error') {
    return 'We couldn\'t verify your session. Please sign in again.'
  }
  if (reason === 'securepage_no_user') {
    return 'You must be signed in to access that page.'
  }
  return null
}

export default function LoginClient() {
  const { refetchSession } = useSession()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') ?? ''
  const status = searchParams.get('status') ?? ''
  const hasAlertedRef = useRef(false)

  const bannerMessage = getReasonMessage(reason)

  useEffect(() => {
    if (reason && !hasAlertedRef.current && bannerMessage) {
      hasAlertedRef.current = true
      window.alert(bannerMessage + (status ? ` (Status: ${status})` : ''))
    }
  }, [reason, status, bannerMessage])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await fetch('/api/backend/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(isLoginResponse(body) ? (body.error ?? 'Invalid login. Please try again.') : 'Invalid login. Please try again.')
        return
      }

      // Cookie is set by backend; no localStorage needed

      const isAuthenticated = await refetchSession()

      if (isAuthenticated) {
        window.location.replace('/dashboard')
      } else {
        setError('Login successful but session verification failed. Please try again.')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Back to dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
            Sign In
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter your email and password to sign in!
          </p>
        </div>
        {bannerMessage && (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100">
            <p>
              {bannerMessage}
              {status ? ` (Status: ${status})` : ''}
            </p>
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label>
              Email <span className="text-error-500">*</span>
            </Label>
            <Input
              type="email"
              placeholder="info@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>
              Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute z-30 -translate-y-1/2 right-4 top-1/2 p-1 cursor-pointer 
                          bg-transparent border-none focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="fill-gray-500 dark:fill-gray-400">
                  {showPassword ? <EyeIcon /> : <EyeCloseIcon />}
                </span>
              </button>
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox checked={isChecked} onChange={setIsChecked} />
              <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                Keep me logged in
              </span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Forgot password? Contact your administrator.
            </span>
          </div>
          <Button type="submit" className="w-full" size="sm">
            Sign in
          </Button>
        </form>
        <div className="mt-5">
          <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
            Don&apos;t have an account? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
