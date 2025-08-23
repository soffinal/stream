import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { delay } from "./delay.ts";

test("delay - fixed delay", async () => {
  const source = new Stream<number>();
  const delayed = source.pipe(delay(50));

  const results: number[] = [];
  const timestamps: number[] = [];

  delayed.listen((value) => {
    results.push(value);
    timestamps.push(Date.now());
  });

  const start = Date.now();
  source.push(1, 2, 3);

  await new Promise((resolve) => setTimeout(resolve, 200));

  expect(results).toEqual([1, 2, 3]);
  timestamps.forEach((ts) => {
    expect(ts - start).toBeGreaterThanOrEqual(45);
  });
});

test("delay - dynamic delay", async () => {
  const source = new Stream<number>();
  const delayed = source.pipe(delay((value) => value * 20));

  const results: number[] = [];
  delayed.listen((value) => results.push(value));

  source.push(1, 2, 3); // 20ms, 20+40ms, 40+60ms delays

  await new Promise((resolve) => setTimeout(resolve, 124));

  expect(results).toEqual([1, 2, 3]);
});

test("delay - real-world: rate limiting", async () => {
  const requests = new Stream<string>();
  const rateLimited = requests.pipe(delay(100)); // 100ms between requests

  const results: string[] = [];
  rateLimited.listen((req) => results.push(req));

  requests.push("req1", "req2", "req3");

  await new Promise((resolve) => setTimeout(resolve, 350));

  expect(results).toEqual(["req1", "req2", "req3"]);
});
