import { redirect } from 'next/navigation'
import getUserSession from '@/utils/sessionUtils.server'

export default async function HomePage() {
  const user = await getUserSession()

  if (!user) {
    redirect('/login')
    return null
  }

  redirect('/dashboard')
  return null
}
