import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { switchMap } from "./switchMap";

describe("switchMap pattern", () => {
  it("should switch to new inner stream", async () => {
    const source = new Stream<number>();
    const switched = source.pipe(
      switchMap((n) => {
        const inner = new Stream<string>();
        setTimeout(() => inner.push(`result-${n}`), 10);
        return inner;
      }),
    );

    const results: string[] = [];
    switched.listen((value) => results.push(value));

    source.push(1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(results).toEqual(["result-1"]);
  });

  it("should cancel previous inner stream", async () => {
    const source = new Stream<number>();
    const switched = source.pipe(
      switchMap((n) => {
        const inner = new Stream<string>();
        setTimeout(() => inner.push(`result-${n}`), 50);
        return inner;
      }),
    );

    const results: string[] = [];
    switched.listen((value) => results.push(value));

    source.push(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    source.push(2); // Cancel first
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(results).toEqual(["result-2"]); // Only second result
  });

  it("should handle rapid switches", async () => {
    const source = new Stream<number>();
    const switched = source.pipe(
      switchMap((n) => {
        const inner = new Stream<string>();
        setTimeout(() => inner.push(`result-${n}`), 30);
        return inner;
      }),
    );

    const results: string[] = [];
    switched.listen((value) => results.push(value));

    source.push(1);
    source.push(2);
    source.push(3);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(results).toEqual(["result-3"]); // Only last result
  });
});
