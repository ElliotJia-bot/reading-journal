// Reuse an in-progress request, but let later calls revalidate server-side data.
export function singleFlight<T>() {
  const pending = new Map<string, Promise<T>>();
  return (key: string, request: () => Promise<T>): Promise<T> => {
    const current = pending.get(key);
    if (current) return current;
    const next = Promise.resolve()
      .then(request)
      .then(
        (result) => {
          pending.delete(key);
          return result;
        },
        (error) => {
          pending.delete(key);
          throw error;
        },
      );
    pending.set(key, next);
    return next;
  };
}
