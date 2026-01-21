import { it, expect, describe } from "bun:test";
import { Stream } from "../../stream";
import { gate } from "./gate";

describe("gate transformer", () => {
  it("allows values when open", async () => {
    const source = new Stream<number>();
    const g = source.pipe(gate());
    const values: number[] = [];

    g.listen((value) => values.push(value));

    source.push(1, 2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(values).toEqual([1, 2, 3]);
    expect(g.gate.isOpen).toBe(true);
  });

  it("blocks values when closed", async () => {
    const source = new Stream<number>();
    const g = source.pipe(gate());
    const values: number[] = [];

    g.listen((value) => values.push(value));

    source.push(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    g.gate.close();
    source.push(2, 3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(values).toEqual([1]);
    expect(g.gate.isOpen).toBe(false);
  });

  it("reopens and allows values", async () => {
    const source = new Stream<number>();
    const g = source.pipe(gate());
    const values: number[] = [];

    g.listen((value) => values.push(value));

    source.push(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    g.gate.close();
    source.push(2);
    await new Promise((resolve) => setTimeout(resolve, 10));
    g.gate.open();
    source.push(3);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(values).toEqual([1, 3]);
    expect(g.gate.isOpen).toBe(true);
  });

  it("can toggle open/close multiple times", async () => {
    const source = new Stream<number>();
    const g = source.pipe(gate());
    const values: number[] = [];

    g.listen((value) => values.push(value));

    source.push(1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    g.gate.close();
    source.push(2);
    await new Promise((resolve) => setTimeout(resolve, 5));
    g.gate.open();
    source.push(3);
    await new Promise((resolve) => setTimeout(resolve, 5));
    g.gate.close();
    source.push(4);
    await new Promise((resolve) => setTimeout(resolve, 5));
    g.gate.open();
    source.push(5);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(values).toEqual([1, 3, 5]);
  });

  it("starts open by default", () => {
    const source = new Stream<number>();
    const g = source.pipe(gate());

    expect(g.gate.isOpen).toBe(true);
  });
});
