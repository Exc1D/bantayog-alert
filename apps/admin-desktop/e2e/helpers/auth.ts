import { Page } from '@playwright/test'

const AUTH_EMULATOR_URL = 'http://localhost:9099'
const API_KEY = 'fake-api-key'

export async function createTestUser(
  page: Page,
  email: string,
  password: string,
): Promise<{ idToken: string; localId: string }> {
  const response = await page.evaluate(
    async ({ url, apiKey, userEmail, userPassword }) => {
      const res = await fetch(
        `${url}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
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
    { url: AUTH_EMULATOR_URL, apiKey: API_KEY, userEmail: email, userPassword: password },
  )

  return { idToken: response.idToken, localId: response.localId }
}

export async function signInWithTestUser(
  page: Page,
  email: string,
  password: string,
): Promise<{ idToken: string }> {
  const response = await page.evaluate(
    async ({ url, apiKey, userEmail, userPassword }) => {
      const res = await fetch(
        `${url}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
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
    { url: AUTH_EMULATOR_URL, apiKey: API_KEY, userEmail: email, userPassword: password },
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
