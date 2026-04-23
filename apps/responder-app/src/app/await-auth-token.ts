import { onIdTokenChanged, type Auth, type User } from 'firebase/auth'

export async function awaitFreshAuthToken(auth: Auth): Promise<User | null> {
  const user = auth.currentUser
  if (!user) return null

  const refreshed = new Promise<User | null>((resolve, reject) => {
    const unsubscribe = onIdTokenChanged(auth, (nextUser) => {
      if (nextUser?.uid !== user.uid) {
        return
      }
      unsubscribe()
      resolve(nextUser)
    })

    user.getIdToken(true).catch((err: unknown) => {
      unsubscribe()
      reject(err instanceof Error ? err : new Error(String(err)))
    })
  })

  return refreshed
}
