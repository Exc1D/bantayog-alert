export function assertNoEmulatorInProduction(
  command: string,
  mode: string,
  rawEmulator: string | undefined,
  appName: string,
): void {
  const normalized = String(rawEmulator).toLowerCase()
  const enabled = normalized === 'true' || normalized === '1'

  if (command === 'build' && mode === 'production' && enabled) {
    throw new Error(
      `Refusing production ${appName} build with VITE_USE_EMULATOR=${String(rawEmulator)}. ` +
        'Set VITE_USE_EMULATOR=false for staging/prod Hosting builds.',
    )
  }
}
