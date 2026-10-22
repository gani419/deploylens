export function createQueuedSender(send) {
  let queue = Promise.resolve();
  let firstError;

  const enqueue = event => {
    queue = queue.then(() => new Promise((resolve, reject) => {
      try { send(event, error => error ? reject(error) : resolve()); }
      catch (error) { reject(error); }
    })).catch(error => { firstError ??= error; });
  };

  return {
    enqueue,
    async flush() {
      await queue;
      if (firstError) throw firstError;
    },
  };
}
