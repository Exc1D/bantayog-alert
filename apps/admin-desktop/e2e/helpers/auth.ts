import type { Page } from '@playwright/test'

const AUTH_EMULATOR_URL = 'http://localhost:9099'
const API_KEY = 'fake-api-key'

type FirebaseAuthEndpoint = 'accounts:signUp' | 'accounts:signInWithPassword'

type FirebaseAuthResponse = {
  idToken?: string
  localId?: string
  error?: { message?: string }
}

async function authenticateWithEmulator(
  page: Page,
  endpoint: FirebaseAuthEndpoint,
  email: string,
  password: string,
): Promise<FirebaseAuthResponse & { idToken: string }> {
  const response = await page.evaluate<
    FirebaseAuthResponse,
    {
      url: string
      apiKey: string
      endpoint: FirebaseAuthEndpoint
      userEmail: string
      userPassword: string
    }
  >(
    async ({ url, apiKey, endpoint: authEndpoint, userEmail, userPassword }) => {
      const res = await fetch(
        `${url}/identitytoolkit.googleapis.com/v1/${authEndpoint}?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            password: userPassword,
            returnSecureToken: true,
          }),
        },
      )
      return res.json()
    },
    { url: AUTH_EMULATOR_URL, apiKey: API_KEY, endpoint, userEmail: email, userPassword: password },
  )

  if (!response.idToken) {
    throw new Error(response.error?.message ?? `Firebase Auth emulator ${endpoint} failed`)
  }

  return { ...response, idToken: response.idToken }
}

export async function createTestUser(
  page: Page,
  email: string,
  password: string,
): Promise<{ idToken: string; localId: string }> {
  const response = await authenticateWithEmulator(page, 'accounts:signUp', email, password)

  if (!response.localId) {
    throw new Error('Firebase Auth emulator sign-up did not return localId')
  }

  return { idToken: response.idToken, localId: response.localId }
}

export async function signInWithTestUser(
  page: Page,
  email: string,
  password: string,
): Promise<{ idToken: string }> {
  const response = await authenticateWithEmulator(
    page,
    'accounts:signInWithPassword',
    email,
    password,
  )

  return { idToken: response.idToken }
}

export async function setAuthCookie(page: Page, idToken: string): Promise<void> {
  // Set the Firebase auth cookie for the emulator
  await page.context().addCookies([
    {
      name: '__session',
      value: idToken,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    },
  ])
}
