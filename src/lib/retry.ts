type RetryOptions = {
  retries: number
  delayMs?: number
  wait?: (delayMs: number) => Promise<void>
}

const waitFor = (delayMs: number) => new Promise<void>((resolve) => window.setTimeout(resolve, delayMs))

export async function retry<T>(operation: () => Promise<T>, { retries, delayMs = 0, wait = waitFor }: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= retries) throw error
      if (delayMs > 0) await wait(delayMs)
    }
  }
}
