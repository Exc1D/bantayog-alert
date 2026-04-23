import { onIdTokenChanged, type Auth, type User } from 'firebase/auth'

export async function awaitFreshAuthToken(auth: Auth): Promise<User | null> {
  const user = auth.currentUser
  if (!user) return null

  const refreshed = new Promise<User | null>((resolve) => {
    const unsubscribe = onIdTokenChanged(auth, (nextUser) => {
      if (nextUser?.uid !== user.uid) {
        return
      }
      unsubscribe()
      resolve(nextUser)
    })
  })

  await user.getIdToken(true)
  return refreshed
}
