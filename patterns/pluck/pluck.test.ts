import { describe, it, expect } from "bun:test";
import { Stream } from "../../src/stream";
import { pluck } from "./pluck";

describe("pluck pattern", () => {
  it("should extract property", async () => {
    const stream = new Stream<{ name: string; age: number }>();
    const names = stream.pipe(pluck("name"));

    const results: string[] = [];
    names.listen((value) => results.push(value));

    stream.push({ name: "Alice", age: 30 }, { name: "Bob", age: 25 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual(["Alice", "Bob"]);
  });
});
