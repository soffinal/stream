import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { audit } from "./audit";

describe("audit pattern", () => {
  it("should emit first value then ignore until quiet", async () => {
    const stream = new Stream<number>();
    const audited = stream.pipe(audit(100));

    const results: number[] = [];
    audited.listen((value) => results.push(value));

    stream.push(1);
    stream.push(2); // Ignored
    stream.push(3); // Ignored
    await new Promise((resolve) => setTimeout(resolve, 120));
    stream.push(4); // Emitted after quiet
    stream.push(5); // Ignored

    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(results).toEqual([1, 4]);
  });

  it("should handle rapid emissions", async () => {
    const stream = new Stream<number>();
    const audited = stream.pipe(audit(50));

    const results: number[] = [];
    audited.listen((value) => results.push(value));

    for (let i = 0; i < 10; i++) {
      stream.push(i);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([0]); // Only first value
  });
});
