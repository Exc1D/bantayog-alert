/**
 * Shared Functions Service
 *
 * Provides typed wrappers for Firebase Cloud Functions callable functions.
 * Handles consistent error handling and type safety.
 */

import { httpsCallable, HttpsCallableResult } from 'firebase/functions'
import { functions } from '@/app/firebase/config'

/**
 * Generic Firebase function caller
 *
 * Calls a Firebase Cloud Function with proper typing and error handling.
 *
 * @template T - The expected return data type from the function
 * @template D - The input data type (defaults to any)
 * @param functionName - The name of the callable function
 * @param data - Optional data to pass to the function
 * @returns The function's response data
 * @throws Error if the function call fails
 *
 * @example
 * ```typescript
 * // Simple call
 * const result = await callFunction('helloWorld')
 *
 * // Call with data
 * const result = await callFunction('createUser', { name: 'John' })
 *
 * // With typing
 * interface CreateUserResponse {
 *   userId: string
 *   createdAt: number
 * }
 *
 * const result = await callFunction<CreateUserResponse>('createUser', {
 *   name: 'John'
 * })
 * console.log(result.userId)
 * ```
 */
export async function callFunction<T = unknown, D = unknown>(
  functionName: string,
  data?: D
): Promise<T> {
  try {
    const callable = httpsCallable<D, T>(functions, functionName, {
      timeout: 54000, // 54 seconds (maximum allowed)
    })

    const result = await callable(data ?? ({} as D))

    return result.data
  } catch (error) {
    // Extract error message from Firebase error or use generic message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    const newError = new Error(`Failed to call ${functionName}: ${errorMessage}`)

    // Add cause property if it's an Error (ES2022 feature)
    if (error instanceof Error) {
      newError.cause = error
    }

    throw newError
  }
}

/**
 * Batch function caller
 *
 * Calls multiple functions in parallel and returns all results.
 * Useful for independent function calls that can run concurrently.
 *
 * @param calls - Array of function calls to execute
 * @returns Array of results in the same order as the calls
 * @throws Error if any function call fails
 *
 * @example
 * ```typescript
 * const results = await callFunctionsBatch([
 *   { name: 'getUser', data: { userId: '123' } },
 *   { name: 'getPosts', data: { limit: 10 } },
 *   { name: 'getStats' }
 * ])
 *
 * const [user, posts, stats] = results
 * ```
 */
export async function callFunctionsBatch<T extends unknown[], D extends unknown[]>(
  calls: { name: string; data?: D[number] }[]
): Promise<T> {
  try {
    const promises = calls.map((call) => callFunction(call.name, call.data))

    return (await Promise.all(promises)) as T
  } catch (error) {
    const newError = new Error('Failed to execute batch function calls')
    if (error instanceof Error) {
      newError.cause = error
    }
    throw newError
  }
}

/**
 * Retrying function caller
 *
 * Calls a function with automatic retry on failure.
 * Useful for functions that may fail temporarily due to network issues.
 *
 * @template T - The expected return data type
 * @template D - The input data type
 * @param functionName - The name of the callable function
 * @param data - Optional data to pass to the function
 * @param options - Retry options
 * @returns The function's response data
 * @throws Error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await callFunctionWithRetry(
 *   'unstableFunction',
 *   { input: 'data' },
 *   { maxRetries: 3, delayMs: 1000 }
 * )
 * ```
 */
export async function callFunctionWithRetry<T = unknown, D = unknown>(
  functionName: string,
  data?: D,
  options?: { maxRetries?: number; delayMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const delayMs = options?.delayMs ?? 1000

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callFunction<T, D>(functionName, data)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        // Wait before retrying with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)))
      }
    }
  }

  throw lastError || new Error('All retry attempts failed')
}
