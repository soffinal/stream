import { describe, test, expect } from "bun:test";
import { Stream } from "../../stream";
import { microbatch } from "./microbatch";

describe("microbatch", () => {
  test("captures values pushed before listener (HOT phase)", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    source.push(1, 2, 3);

    const values: number[] = [];
    batched.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values).toEqual([1, 2, 3]);
  });

  test("becomes passthrough after first microtask (COLD phase)", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    const values: number[] = [];
    batched.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));

    source.push(4, 5, 6);
    expect(values).toEqual([4, 5, 6]);
  });

  test("HOT then COLD phases work together", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    // HOT phase
    source.push(1, 2, 3);

    const values: number[] = [];
    batched.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values).toEqual([1, 2, 3]);

    // COLD phase
    source.push(4, 5);
    expect(values).toEqual([1, 2, 3, 4, 5]);
  });

  test("works with no values pushed in HOT phase", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    const values: number[] = [];
    batched.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values).toEqual([]);

    // COLD phase still works
    source.push(1, 2);
    expect(values).toEqual([1, 2]);
  });

  test("multiple listeners receive same values", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    source.push(1, 2, 3);

    const values1: number[] = [];
    const values2: number[] = [];

    batched.listen((v) => values1.push(v));
    batched.listen((v) => values2.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values1).toEqual([1, 2, 3]);
    expect(values2).toEqual([1, 2, 3]);
  });

  test("works with transformations", async () => {
    const source = new Stream<number>();
    const processed = source
      .pipe(microbatch())
      .pipe((s) => new Stream(async function* () {
        for await (const v of s) {
          if (v > 0) yield v * 2;
        }
      }));

    source.push(-1, 2, 3);

    const values: number[] = [];
    processed.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values).toEqual([4, 6]);
  });

  test("listener can be added after multiple event loops", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    source.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const values: number[] = [];
    batched.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values).toEqual([1, 2, 3]);
  });

  test("cleanup works correctly", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    source.push(1, 2, 3);

    const values: number[] = [];
    const abort = batched.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values).toEqual([1, 2, 3]);

    abort();

    source.push(4, 5);
    expect(values).toEqual([1, 2, 3]); // No new values after abort
  });

  test("HOT listener aborts even with no downstream listener", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    // Wait for HOT phase to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // HOT listener should be aborted, so hasListeners should be false
    expect(source.hasListeners).toBe(false);
  });

  test("handles rapid synchronous pushes", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    // Rapid pushes
    for (let i = 0; i < 100; i++) {
      source.push(i);
    }

    const values: number[] = [];
    batched.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values.length).toBe(100);
    expect(values[0]).toBe(0);
    expect(values[99]).toBe(99);
  });

  test("works with async iteration", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    source.push(1, 2, 3);

    const values: number[] = [];
    (async () => {
      for await (const v of batched) {
        values.push(v);
        if (v === 3) break;
      }
    })();

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values).toEqual([1, 2, 3]);
  });

  test("bypass pattern works (push to batched stream)", async () => {
    const source = new Stream<number>();
    const batched = source.pipe(microbatch());

    // Bypass: push directly to batched stream
    batched.push(99);

    const values: number[] = [];
    batched.listen((v) => values.push(v));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(values).toEqual([99]); // Bypasses HOT phase
  });

  test("initialization pattern", async () => {
    const config = new Stream<{ key: string; value: string }>();
    const settings = config.pipe(microbatch());

    // Setup phase
    config.push({ key: "theme", value: "dark" });
    config.push({ key: "lang", value: "en" });
    config.push({ key: "timezone", value: "UTC" });

    const configs: Array<{ key: string; value: string }> = [];
    settings.listen((cfg) => configs.push(cfg));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(configs).toEqual([
      { key: "theme", value: "dark" },
      { key: "lang", value: "en" },
      { key: "timezone", value: "UTC" },
    ]);
  });
});
