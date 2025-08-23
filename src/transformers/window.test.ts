import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { window } from "./window.ts";
import { map } from "./map.ts";

test("window - fixed size", async () => {
  const source = new Stream<number>();
  const windowed = source.pipe(window(3));
  
  const results: number[][] = [];
  windowed.listen(win => results.push([...win]));
  
  source.push(1, 2, 3, 4, 5, 6);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([[1, 2, 3], [4, 5, 6]]); // Complete windows only
});

test("window - sliding window", async () => {
  const source = new Stream<number>();
  const sliding = source.pipe(window(3, 1));
  
  const results: number[][] = [];
  sliding.listen(win => results.push([...win]));
  
  source.push(1, 2, 3, 4, 5);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5]
  ]);
});

test("window - real-world: moving average", async () => {
  const prices = new Stream<number>();
  const movingAverages = prices
    .pipe(window(3, 1))
    .pipe(map(window => window.reduce((sum, price) => sum + price, 0) / window.length));
  
  const results: number[] = [];
  movingAverages.listen(avg => results.push(avg));
  
  prices.push(10, 12, 14, 16, 18);
  await new Promise(resolve => setTimeout(resolve, 0));
  
  expect(results).toEqual([12, 14, 16]); // (10+12+14)/3, (12+14+16)/3, (14+16+18)/3
});