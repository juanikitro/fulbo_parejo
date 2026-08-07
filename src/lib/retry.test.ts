import { describe, expect, it, vi } from 'vitest'
import { retry } from './retry'

describe('retry', () => {
  it('makes the configured additional retries before succeeding', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue('loaded')
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(retry(operation, { retries: 5, delayMs: 1000, wait })).resolves.toBe('loaded')

    expect(operation).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenNthCalledWith(1, 1000)
  })

  it('throws the final error after five additional retries', async () => {
    const failure = new Error('network')
    const operation = vi.fn().mockRejectedValue(failure)

    await expect(retry(operation, { retries: 5 })).rejects.toThrow(failure)

    expect(operation).toHaveBeenCalledTimes(6)
  })
})
