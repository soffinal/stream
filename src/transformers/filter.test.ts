import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { filter } from "./filter.ts";

test("filter - basic predicate filtering", async () => {
  const source = new Stream<number>();
  const evens = source.pipe(filter((n) => n % 2 === 0));

  const results: number[] = [];
  evens.listen((n) => results.push(n));

  source.push(1, 2, 3, 4, 5, 6);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([2, 4, 6]);
});

test("filter - type guard filtering", async () => {
  const source = new Stream<string | number>();
  const strings = source.pipe(filter((x): x is string => typeof x === "string"));

  const results: string[] = [];
  strings.listen((s) => results.push(s));

  source.push(1, "hello", 2, "world", 3, "test");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual(["hello", "world", "test"]);
});

test("filter - async predicate", async () => {
  const source = new Stream<number>();
  const asyncFiltered = source.pipe(
    filter(async (n) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return n > 5;
    })
  );

  const results: number[] = [];
  asyncFiltered.listen((n) => results.push(n));

  source.push(1, 6, 3, 8, 2, 10);

  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(results).toEqual([6, 8, 10]);
});

test("filter - stateful filtering (increasing values)", async () => {
  const source = new Stream<number>();
  const increasing = source.pipe(filter(0, (prev, curr) => [curr > prev, Math.max(prev, curr)]));

  const results: number[] = [];
  increasing.listen((n) => results.push(n));

  source.push(1, 3, 2, 5, 4, 6, 1, 8);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 3, 5, 6, 8]);
});

test("filter - empty stream", async () => {
  const source = new Stream<number>();
  const filtered = source.pipe(filter((n) => n > 0));

  const results: number[] = [];
  filtered.listen((n) => results.push(n));

  // No values pushed
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(results).toEqual([]);
});

test("filter - all values filtered out", async () => {
  const source = new Stream<number>();
  const filtered = source.pipe(filter((n) => n > 100));

  const results: number[] = [];
  filtered.listen((n) => results.push(n));

  source.push(1, 2, 3, 4, 5);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([]);
});

test("filter - real-world: user input validation", async () => {
  interface UserInput {
    email: string;
    age: number;
  }

  const userInputs = new Stream<UserInput>();
  const validInputs = userInputs.pipe(filter((input) => input.email.includes("@") && input.age >= 18));

  const results: UserInput[] = [];
  validInputs.listen((input) => results.push(input));

  userInputs.push(
    { email: "invalid", age: 25 },
    { email: "valid@test.com", age: 16 },
    { email: "user@example.com", age: 25 },
    { email: "another@test.com", age: 30 }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { email: "user@example.com", age: 25 },
    { email: "another@test.com", age: 30 },
  ]);
});
