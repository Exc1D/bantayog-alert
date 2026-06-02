/**
 * Build guard — refuse production builds when the emulator flag is enabled.
 * Keep this at the root so all Vite configs can import it without a package.
 *
 * @param {string} command
 * @param {string} mode
 * @param {string | undefined} rawEmulator
 * @param {string} appName
 */
export function assertNoEmulatorInProduction(command, mode, rawEmulator, appName) {
  const normalized = String(rawEmulator).trim().toLowerCase()
  const enabled = normalized === 'true' || normalized === '1'

  if (command === 'build' && mode === 'production' && enabled) {
    throw new Error(
      `Refusing production ${appName} build with VITE_USE_EMULATOR=${String(rawEmulator)}. ` +
        'Set VITE_USE_EMULATOR=false for staging/prod Hosting builds.',
    )
  }
}
