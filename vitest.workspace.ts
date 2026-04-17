import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/shared-validators',
  'packages/shared-firebase',
  'apps/citizen-pwa',
])
