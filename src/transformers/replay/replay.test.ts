import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { replay } from "./replay";

describe("replay pattern", () => {
  it("should replay cached values to new listeners", async () => {
    const stream = new Stream<number>();
    const replayed = stream.pipe(replay({ maxSize: 3 }));

    stream.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const results: number[] = [];
    replayed.listen((value) => results.push(value));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results).toEqual([1, 2, 3]);
  });

  it("should replay to all listeners", async () => {
    const stream = new Stream<number>();
    const replayed = stream.pipe(replay({ initialValues: [0] }));

    const results1: number[] = [];
    const results2: number[] = [];

    replayed.listen((value) => results1.push(value));
    replayed.listen((value) => results2.push(value));
    await new Promise((resolve) => setTimeout(resolve, 10));

    stream.push(1, 2);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results1).toEqual([0, 1, 2]);
    expect(results2).toEqual([0, 1, 2]);
  });

  it("should replay to late subscribers", async () => {
    const stream = new Stream<string>();
    const replayed = stream.pipe(replay({ initialValues: ["init", "ready"] }));

    const results1: string[] = [];
    replayed.listen((value) => results1.push(value));

    stream.push("hello");
    await new Promise((resolve) => setTimeout(resolve, 10));

    const results2: string[] = [];
    replayed.listen((value) => results2.push(value));

    stream.push("world");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(results1).toEqual(["init", "ready", "hello", "world"]);
    expect(results2).toEqual(["init", "ready", "hello", "world"]);
  });
});
