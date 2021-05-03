/**
 * Returns a promise that resolves after `n` seconds.
 * @param n   How many seconds to wait
 */
export function sleep(n) {
  return new Promise((resolve) => setTimeout(resolve, n * 1000));
}
