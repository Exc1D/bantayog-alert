import { AnonymousProfile } from '@/features/profile/components/AnonymousProfile'
import { RegisteredProfile } from '@/features/profile/components/RegisteredProfile'
import { useAuth } from '@/shared/hooks/useAuth'

export function ProfileRoute() {
  const { user, loading } = useAuth()

  if (loading) return <div className="min-h-screen bg-gray-50" aria-label="Loading profile" />
  return user ? <RegisteredProfile /> : <AnonymousProfile />
}
