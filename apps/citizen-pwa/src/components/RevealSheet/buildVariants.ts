export interface RevealVariant {
  headline: string
  subline: string
  sublineTl: string | undefined
  bannerVariant: 'success' | 'queued' | 'failed' | 'danger'
  receiverText: string | undefined
  primaryButton: string
  primaryVariant: 'primary' | 'amber' | 'red'
  secondaryButton: string | undefined
  permissionText: string
}

export function buildVariants(mdrrmoLabel: string): Record<string, RevealVariant> {
  return {
    success: {
      headline: 'We heard you. We are here.',
      subline: `Your report is with ${mdrrmoLabel}. Keep your line open.`,
      sublineTl: 'Narinig namin kayo. Hawak na ng MDRRMO ang inyong ulat.',
      bannerVariant: 'success',
      receiverText: `Received by ${mdrrmoLabel}`,
      primaryButton: 'Track this report',
      primaryVariant: 'primary',
      secondaryButton: undefined,
      permissionText: "You can close this app. We'll text you.",
    },
    queued: {
      headline: "Saved. We'll send it for you.",
      subline: `Your report is safe on this phone. The moment signal returns, we'll automatically forward it to ${mdrrmoLabel}. No action needed from you. Walang mawawala.`,
      sublineTl: undefined,
      bannerVariant: 'queued',
      receiverText: 'Saved to device · auto-send when online',
      primaryButton: 'Try sending now',
      primaryVariant: 'amber',
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll keep trying quietly in the background.",
    },
    failed_retryable: {
      headline: 'Your report is safe. Still trying.',
      subline:
        "We saved it securely on your phone and are retrying automatically. The network is having trouble. This is not your fault and nothing is lost. If it's a life-threatening emergency, call now.",
      sublineTl: 'Ligtas ang inyong ulat. Nagre-retry kami. Kung emergency, tawagan kami ngayon.',
      bannerVariant: 'failed',
      receiverText: undefined,
      primaryButton: 'Retry now',
      primaryVariant: 'red',
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll hold this draft for 24 hours and keep retrying.",
    },
    failed_terminal: {
      headline: "We couldn't send. Please call now.",
      subline: `Your draft is saved on this phone, but we have stopped retrying after several attempts. If this is an emergency, call ${mdrrmoLabel} right now. It is faster than the app right now.`,
      sublineTl:
        'Hindi naipasa ang ulat. Kung emergency, tumawag agad sa hotline o magpadala ng SMS.',
      bannerVariant: 'danger',
      receiverText: undefined,
      primaryButton: 'Call hotline now',
      primaryVariant: 'amber',
      secondaryButton: 'Keep draft & close',
      permissionText: 'We will keep your draft on this device for 24 hours.',
    },
  }
}
