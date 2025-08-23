import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { pairwise } from "./pairwise.ts";

test("pairwise - basic pairs", async () => {
  const source = new Stream<number>();
  const pairs = source.pipe(pairwise());

  const results: Array<[number, number]> = [];
  pairs.listen((pair) => results.push(pair));

  source.push(1, 2, 3, 4);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [1, 2],
    [2, 3],
    [3, 4],
  ]);
});

test("pairwise - with predicate", async () => {
  const source = new Stream<number>();
  const increasingPairs = source.pipe(pairwise((prev, curr) => curr > prev));

  const results: Array<[number, number]> = [];
  increasingPairs.listen((pair) => results.push(pair));

  source.push(1, 3, 2, 5, 4, 6);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [1, 3],
    [2, 5],
    [4, 6],
  ]);
});

test("pairwise - with mapper", async () => {
  const source = new Stream<number>();
  const differences = source.pipe(pairwise((prev, curr) => curr - prev));

  const results: number[] = [];
  differences.listen((diff) => results.push(diff));

  source.push(1, 4, 2, 7, 3);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([3, -2, 5, -4]);
});

test("pairwise - real-world: price changes", async () => {
  interface PricePoint {
    symbol: string;
    price: number;
    timestamp: number;
  }

  const prices = new Stream<PricePoint>();
  const priceChanges = prices.pipe(
    pairwise((prev, curr) => ({
      symbol: curr.symbol,
      change: curr.price - prev.price,
      changePercent: ((curr.price - prev.price) / prev.price) * 100,
      timestamp: curr.timestamp,
    }))
  );

  const results: Array<{ symbol: string; change: number; changePercent: number; timestamp: number }> = [];
  priceChanges.listen((change) => results.push(change));

  const now = Date.now();
  prices.push(
    { symbol: "AAPL", price: 100, timestamp: now },
    { symbol: "AAPL", price: 105, timestamp: now + 1000 },
    { symbol: "AAPL", price: 102, timestamp: now + 2000 }
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { symbol: "AAPL", change: 5, changePercent: 5, timestamp: now + 1000 },
    { symbol: "AAPL", change: -3, changePercent: -2.857142857142857, timestamp: now + 2000 },
  ]);
});

test("pairwise - edge case: single value", async () => {
  const source = new Stream<number>();
  const pairs = source.pipe(pairwise());

  const results: Array<[number, number]> = [];
  pairs.listen((pair) => results.push(pair));

  source.push(42);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([]);
});
