export function assertNoEmulatorInProduction(command, mode, rawEmulator, appName) {
    const normalized = String(rawEmulator).toLowerCase();
    const enabled = normalized === 'true' || normalized === '1';
    if (command === 'build' && mode === 'production' && enabled) {
        throw new Error(`Refusing production ${appName} build with VITE_USE_EMULATOR=${String(rawEmulator)}. ` +
            'Set VITE_USE_EMULATOR=false for staging/prod Hosting builds.');
    }
}
//# sourceMappingURL=index.js.map