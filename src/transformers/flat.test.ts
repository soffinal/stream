import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { flat } from "./flat.ts";
import { map } from "./map.ts";

test("flat - basic array flattening", async () => {
  const source = new Stream<number[]>();
  const flattened = source.pipe(flat());

  const results: number[] = [];
  flattened.listen((value) => results.push(value));

  source.push([1, 2], [3, 4], [5]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3, 4, 5]);
});

test("flat - deep flattening", async () => {
  const source = new Stream<number[][][]>();
  const flattened = source.pipe(flat(2));

  const results: number[] = [];
  flattened.listen((value) => results.push(value));

  source.push([[[1, 2]], [[3, 4]]], [[[5, 6]]]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3, 4, 5, 6]);
});

test("flat - mixed content", async () => {
  const source = new Stream<number | number[]>();
  const flattened = source.pipe(flat());

  const results: number[] = [];
  flattened.listen((value) => results.push(value));

  source.push(1, [2, 3], 4, [5]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3, 4, 5]);
});

test("flat - real-world: API response flattening", async () => {
  interface ApiResponse {
    data: Array<{ items: string[] }>;
  }

  const responses = new Stream<ApiResponse>();
  const allItems = responses.pipe(map((response) => response.data.map((d) => d.items))).pipe(flat(1));

  const results: string[] = [];
  allItems.listen((item) => results.push(item));

  responses.push({
    data: [{ items: ["item1", "item2"] }, { items: ["item3"] }],
  });

  await new Promise((r) => setTimeout(r));
  expect(results).toEqual(["item1", "item2", "item3"]);
});

test("flat - edge case: empty arrays", async () => {
  const source = new Stream<number[]>();
  const flattened = source.pipe(flat());

  const results: number[] = [];
  flattened.listen((value) => results.push(value));

  source.push([], [1, 2], [], [3]);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 2, 3]);
});
