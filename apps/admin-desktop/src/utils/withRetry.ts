const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { maxAttempts = isTest ? 1 : 3, baseDelayMs = 500 } = options
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxAttempts) break
      const delay = isTest ? 0 : baseDelayMs * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
