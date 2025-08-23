import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { zip } from "./zip.ts";

test("zip - basic two streams", async () => {
  const stream1 = new Stream<number>();
  const stream2 = new Stream<string>();
  const zipped = stream1.pipe(zip(stream2));
  
  const results: Array<[number, string]> = [];
  zipped.listen(pair => results.push(pair));
  
  stream1.push(1, 2);
  stream2.push("a", "b");
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([[1, "a"], [2, "b"]]);
});

test("zip - with combiner", async () => {
  const numbers = new Stream<number>();
  const letters = new Stream<string>();
  const combined = numbers.pipe(zip(letters, (n, l) => `${n}${l}`));
  
  const results: string[] = [];
  combined.listen(result => results.push(result));
  
  numbers.push(1, 2, 3);
  letters.push("a", "b", "c");
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual(["1a", "2b", "3c"]);
});

test("zip - multiple streams", async () => {
  const stream1 = new Stream<number>();
  const stream2 = new Stream<string>();
  const stream3 = new Stream<boolean>();
  
  const zipped = stream1.pipe(zip(stream2, stream3));
  
  const results: Array<[number, string, boolean]> = [];
  zipped.listen(tuple => results.push(tuple));
  
  stream1.push(1, 2);
  stream2.push("a", "b");
  stream3.push(true, false);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([[1, "a", true], [2, "b", false]]);
});

test("zip - real-world: coordinate pairs", async () => {
  const xCoords = new Stream<number>();
  const yCoords = new Stream<number>();
  
  const points = xCoords.pipe(zip(yCoords, (x, y) => ({ x, y })));
  
  const results: Array<{ x: number; y: number }> = [];
  points.listen(point => results.push(point));
  
  xCoords.push(10, 20, 30);
  yCoords.push(15, 25, 35);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([
    { x: 10, y: 15 },
    { x: 20, y: 25 },
    { x: 30, y: 35 }
  ]);
});

test("zip - edge case: uneven streams", async () => {
  const stream1 = new Stream<number>();
  const stream2 = new Stream<string>();
  const zipped = stream1.pipe(zip(stream2));
  
  const results: Array<[number, string]> = [];
  zipped.listen(pair => results.push(pair));
  
  stream1.push(1, 2, 3);
  stream2.push("a", "b"); // Shorter stream
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([[1, "a"], [2, "b"]]);
});