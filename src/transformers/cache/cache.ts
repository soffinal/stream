import { Stream } from "../../stream";

export function cache<T>(
  options?: cache.Options<T>,
): Stream.Transformer<Stream<T>, Stream<T> & { cache: cache.Cache<T> }> {
  return function (source) {
    const { initialValues = [], size, dropStrategy = "oldest", ttl } = options ?? {};

    const cacheArray: CacheEntry<T>[] = initialValues.map((value) => ({
      value,
      timestamp: Date.now(),
    }));

    const output = new Stream<T>();
    const evicted = new Stream<{ value: T; reason: "size" | "ttl" }>();

    let cleanupTimer: any;

    const startCleanup = () => {
      if (ttl === undefined || cleanupTimer !== undefined) return;

      cleanupTimer = setInterval(
        () => {
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
        },
        Math.min(ttl / 4, Math.max(500, ttl / 10)),
      ); // Check at quarter TTL, min 500ms, max 10% of TTL
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

      if (size !== undefined && cacheArray.length > size) {
        const entry = dropStrategy === "oldest" ? cacheArray.shift() : cacheArray.pop();
        if (entry) evicted.push({ value: entry.value, reason: "size" });
      }

      output.push(value);
    });

    Object.defineProperty(output, "cache", {
      value: {
        get values() {
          return cacheArray.map((entry) => entry.value);
        },
        get size() {
          return size;
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

    return output as Stream<T> & { cache: cache.Cache<T> };
  };
}

export namespace cache {
  export type Cache<T> = {
    readonly values: T[];
    readonly size: number | undefined;
    readonly dropStrategy: "oldest" | "newest";
    readonly ttl: number | undefined;
    readonly evicted: Stream<{ value: T; reason: "size" | "ttl" }>;
    clear(): void;
  };

  export type Options<T> = {
    initialValues?: T[];
    size?: number;
    dropStrategy?: "oldest" | "newest";
    ttl?: number;
  };
}
type CacheEntry<T> = {
  value: T;
  timestamp: number;
};
