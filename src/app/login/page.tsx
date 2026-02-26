import { redirect } from 'next/navigation'
import getUserSession from '@/utils/sessionUtils.server'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const session = await getUserSession()

  if (session?.userId && session?.roleId) {
    redirect('/dashboard')
  }

  return <LoginClient />
}
