import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { effect } from "./effect";
import { statefull } from "../statefull";
import { sequential } from "../sequential";

describe("effect", () => {
  it("should execute side effects without transforming values", async () => {
    const stream = new Stream<number>();
    const sideEffects: number[] = [];
    const result = stream.pipe(effect((v) => sideEffects.push(v * 2)));

    const values: number[] = [];
    result.listen((value) => values.push(value));

    stream.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(values).toEqual([1, 2, 3]);
    expect(sideEffects).toEqual([2, 4, 6]);
  });

  it("should support stateful effects", async () => {
    const stream = new Stream<number>();
    const logs: string[] = [];

    const result = stream
      .pipe(
        statefull({ count: 0 }, (state, value) => {
          return [[value, state], { count: state.count + 1 }] as const;
        }),
      )
      .pipe(
        effect(([value, state]) => {
          logs.push(`[${state.count}] ${value}`);
        }),
      )
      .pipe(sequential(([value]) => value));

    const values: number[] = [];
    result.listen((value) => values.push(value));

    stream.push(10, 20, 30);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(values).toEqual([10, 20, 30]);
    expect(logs).toEqual(["[0] 10", "[1] 20", "[2] 30"]);
  });

  it("should support async effects", async () => {
    const stream = new Stream<number>();
    const processed: number[] = [];

    const result = stream.pipe(
      effect(async (v) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        processed.push(v);
      }),
    );

    const values: number[] = [];
    result.listen((value) => values.push(value));

    stream.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(values).toEqual([1, 2, 3]);
    expect(processed).toEqual([1, 2, 3]);
  });
});
