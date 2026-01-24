import { Stream } from "../../stream";

export type Cache<T> = Stream<T> & {
  cache: {
    readonly values: T[];
    readonly size: number | undefined;
    readonly dropStrategy: "oldest" | "newest";
    readonly ttl: number | undefined;
    readonly evicted: Stream<{ value: T; reason: "maxSize" | "ttl" }>;
    clear(): void;
  };
};

export type CacheOptions<T> = {
  initialValues?: T[];
  maxSize?: number;
  dropStrategy?: "oldest" | "newest";
  ttl?: number;
};

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

export function cache<T>(options?: CacheOptions<T>): Stream.Transformer<Stream<T>, Cache<T>> {
  const { initialValues = [], maxSize, dropStrategy = "oldest", ttl } = options ?? {};

  const cacheArray: CacheEntry<T>[] = initialValues.map((value) => ({
    value,
    timestamp: Date.now(),
  }));

  return (source: Stream<T>): Cache<T> => {
    const output = new Stream<T>();
    const evicted = new Stream<{ value: T; reason: "maxSize" | "ttl" }>();

    let cleanupTimer: ReturnType<typeof setInterval> | undefined;

    const startCleanup = () => {
      if (ttl === undefined || cleanupTimer !== undefined) return;

      cleanupTimer = setInterval(() => {
        const now = Date.now();
        let i = 0;
        while (i < cacheArray.length) {
          if (now - cacheArray[i].timestamp >= ttl) {
            const [entry] = cacheArray.splice(i, 1);
            evicted.push({ value: entry.value, reason: "ttl" });
          } else {
            i++;
          }
        }

        // Stop timer if cache is empty
        if (cacheArray.length === 0 && cleanupTimer !== undefined) {
          clearInterval(cleanupTimer);
          cleanupTimer = undefined;
        }
      }, Math.min(ttl / 4, 500)); // Check at quarter TTL or max 500ms
    };

    const stopCleanup = () => {
      if (cleanupTimer !== undefined) {
        clearInterval(cleanupTimer);
        cleanupTimer = undefined;
      }
    };

    // Start cleanup if we have initial values with TTL
    if (ttl !== undefined && cacheArray.length > 0) {
      startCleanup();
    }

    // HOT: Start listening immediately to cache ALL events
    source.listen((value) => {
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
      };

      cacheArray.push(entry);
      startCleanup();

      if (maxSize !== undefined && cacheArray.length > maxSize) {
        const entry = dropStrategy === "oldest" ? cacheArray.shift() : cacheArray.pop();
        if (entry) evicted.push({ value: entry.value, reason: "maxSize" });
      }

      output.push(value);
    });

    Object.defineProperty(output, "cache", {
      value: {
        get values() {
          return cacheArray.map((entry) => entry.value);
        },
        get size() {
          return maxSize;
        },
        get dropStrategy() {
          return dropStrategy;
        },
        get ttl() {
          return ttl;
        },
        get evicted() {
          return evicted;
        },
        clear() {
          stopCleanup();
          cacheArray.length = 0;
        },
      },
      enumerable: true,
      configurable: false,
    });

    return output as Cache<T>;
  };
}
