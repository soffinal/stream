import { it, expect, describe } from "bun:test";
import { Stream } from "../../stream";
import { state } from "./state";

describe("state mixin", () => {
  it("creates state with initial value", () => {
    const source = new Stream<number>();
    const s = source.pipe(state(0));
    expect(s.state.value).toBe(0);
  });

  it("updates value and emits", async () => {
    const source = new Stream<number>();
    const s = source.pipe(state(0));
    const values: number[] = [];

    s.listen((value) => values.push(value));

    s.state.value = 1;
    s.state.value = 2;

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(values).toEqual([1, 2]);
    expect(s.state.value).toBe(2);
  });

  it("creates state from source stream", async () => {
    const source = new Stream<number>();
    const s = source.pipe(state(0));
    const values: number[] = [];

    s.listen((value) => values.push(value));

    source.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(values).toEqual([1, 2, 3]);
  });

  it("maintains current value", () => {
    const source = new Stream<number>();
    const s = source.pipe(state(5));
    s.state.value = 10;
    expect(s.state.value).toBe(10);
    s.state.value = 20;
    expect(s.state.value).toBe(20);
  });

  it("works with all stream methods", async () => {
    const source = new Stream<number>();
    const s = source.pipe(state(0));
    const values: number[] = [];

    s.listen((value) => values.push(value));

    s.push(1);
    s.state.value = 2;
    s.push(3);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(values).toEqual([1, 2, 3]);
  });
});
