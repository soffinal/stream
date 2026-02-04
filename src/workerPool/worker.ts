export const workerUrl = new URL(import.meta.url);

const functions = new Map();

self.onmessage = async (e) => {
  const { type, fnId, fnString, args, taskId, value } = e.data;

  if (type === "register") {
    const fn = eval(`(${fnString})`);
    functions.set(fnId, { fn, args });
    return;
  }

  if (type === "execute") {
    try {
      const { fn, args } = functions.get(fnId);
      const result = await fn(value, args);
      self.postMessage({ taskId, result });
    } catch (error: any) {
      self.postMessage({ taskId, error: error.message });
    }
  }
};
