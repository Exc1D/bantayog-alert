/// <reference types="@testing-library/jest-dom" />
/**
 * Vitest setup file - runs before all tests
 * Import design tokens globally so tests can read CSS custom properties
 */
import './styles/design-tokens.css'
import { vi } from 'vitest'

vi.mock('@bantayog/shared-ui', async () => {
  const actual = await vi.importActual('@bantayog/shared-ui')
  return {
    ...(actual as Record<string, unknown>),
    useAuth: vi.fn(() => ({
      user: null,
      claims: null,
      loading: false,
      signOut: vi.fn(),
      refreshClaims: vi.fn(),
    })),
  }
})
