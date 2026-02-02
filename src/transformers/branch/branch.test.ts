import { describe, it, expect } from "bun:test";
import { Stream } from "../../stream";
import { branch } from "./branch";
import { filter } from "../filter";
import { map } from "../sequential";

describe("branch transformer", () => {
  it("should forward values to target stream", async () => {
    const source = new Stream<number>();
    const branched = new Stream<number>();

    const output = source.pipe(branch(branched));

    const branchedValues: number[] = [];
    const outputValues: number[] = [];

    branched.listen((v) => branchedValues.push(v));
    output.listen((v) => outputValues.push(v));

    source.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(branchedValues).toEqual([1, 2, 3]);
    expect(outputValues).toEqual([1, 2, 3]);
  });

  it("should work in the middle of a chain", async () => {
    const source = new Stream<number>();
    const monitoring = new Stream<number>();

    const result = source
      .pipe(filter((n) => n > 0))
      .pipe(branch(monitoring))
      .pipe(map((n) => n * 2));

    const monitoringValues: number[] = [];
    const resultValues: number[] = [];

    monitoring.listen((v) => monitoringValues.push(v));
    result.listen((v) => resultValues.push(v));

    source.push(-1, 1, 2, -2, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(monitoringValues).toEqual([1, 2, 3]);
    expect(resultValues).toEqual([2, 4, 6]);
  });

  it("should allow multiple branches", async () => {
    const source = new Stream<number>();
    const branch1 = new Stream<number>();
    const branch2 = new Stream<number>();

    const result = source
      .pipe(filter((n) => n > 0))
      .pipe(branch(branch1))
      .pipe(map((n) => n * 2))
      .pipe(branch(branch2))
      .pipe(map((n) => n + 1));

    const branch1Values: number[] = [];
    const branch2Values: number[] = [];
    const resultValues: number[] = [];

    branch1.listen((v) => branch1Values.push(v));
    branch2.listen((v) => branch2Values.push(v));
    result.listen((v) => resultValues.push(v));

    source.push(1, 2, 3);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(branch1Values).toEqual([1, 2, 3]);
    expect(branch2Values).toEqual([2, 4, 6]);
    expect(resultValues).toEqual([3, 5, 7]);
  });

  it("should work with async transformers", async () => {
    const source = new Stream<number>();
    const branched = new Stream<number>();

    const result = source
      .pipe(map(async (n) => n * 2))
      .pipe(branch(branched))
      .pipe(filter((n) => n > 5));

    const branchedValues: number[] = [];
    const resultValues: number[] = [];

    branched.listen((v) => branchedValues.push(v));
    result.listen((v) => resultValues.push(v));

    source.push(1, 2, 3, 4);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(branchedValues).toEqual([2, 4, 6, 8]);
    expect(resultValues).toEqual([6, 8]);
  });
});
