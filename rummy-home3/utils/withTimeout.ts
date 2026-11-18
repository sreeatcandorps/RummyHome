/** Give up on a hung request and show Retry instead of a spinner. */
export const REQUEST_TIMEOUT_MS = 12_000;

/** Reject if `promise` is still pending after `ms`. A hung native call must not block the UI. */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
