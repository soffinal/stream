import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { buffer } from "./buffer.ts";

test("buffer - trigger based", async () => {
  const source = new Stream<number>();
  const trigger = new Stream<void>();
  const buffered = source.pipe(buffer(trigger));

  const results: number[][] = [];
  buffered.listen((buf) => results.push([...buf]));

  source.push(1, 2, 3);
  trigger.push();

  source.push(4, 5);
  trigger.push();
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [1, 2, 3],
    [4, 5],
  ]);
});

test("buffer - count based", async () => {
  const source = new Stream<number>();
  const buffered = source.pipe(buffer(3));

  const results: number[][] = [];
  buffered.listen((buf) => results.push([...buf]));

  source.push(1, 2, 3, 4, 5, 6, 7);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]); // [7] not emitted since buffer incomplete
});

test("buffer - real-world: batch processing", async () => {
  interface Task {
    id: string;
    data: any;
  }

  const tasks = new Stream<Task>();
  const batchTrigger = new Stream<void>();
  const batches = tasks.pipe(buffer(batchTrigger));

  const results: Task[][] = [];
  batches.listen((batch) => {
    // Simulate batch processing
    results.push([...batch]);
  });

  tasks.push({ id: "task1", data: { action: "process" } }, { id: "task2", data: { action: "validate" } });

  batchTrigger.push(); // Process first batch

  tasks.push({ id: "task3", data: { action: "save" } });
  batchTrigger.push(); // Process second batch
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [
      { id: "task1", data: { action: "process" } },
      { id: "task2", data: { action: "validate" } },
    ],
    [{ id: "task3", data: { action: "save" } }],
  ]);
});

test("buffer - function predicate", async () => {
  const source = new Stream<number>();
  const buffered = source.pipe(buffer((buffer, value) => buffer.length >= 3));

  const results: number[][] = [];
  buffered.listen((buf) => results.push([...buf]));

  source.push(1, 2, 3, 4, 5, 6);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]); // No partial [4, 5] - streams are infinite
});

test("buffer - function count selector", async () => {
  const source = new Stream<number>();
  const buffered = source.pipe(buffer((buffer, value) => (value > 10 ? 2 : 3)));

  const results: number[][] = [];
  buffered.listen((buf) => results.push([...buf]));

  source.push(1, 2, 3, 15, 5, 20, 7, 8);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [1, 2, 3],
    [15, 5],
    [20, 7, 8],
  ]); // No partial [20] - need full batches
});

test("buffer - stateful boolean predicate", async () => {
  const source = new Stream<number>();
  const buffered = source.pipe(
    buffer(0, (count, buffer, value) => {
      // Emit when buffer has 3 items
      return [buffer.length >= 3, count];
    })
  );

  const results: number[][] = [];
  buffered.listen((buf) => results.push([...buf]));

  source.push(1, 2, 3, 4, 5, 6);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
});

test("buffer - stateful count selector", async () => {
  const source = new Stream<number>();
  const buffered = source.pipe(
    buffer([] as number[], (history, buffer, value) => {
      const newHistory = [...history, value].slice(-3);
      const avg = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
      return [Math.ceil(avg), newHistory];
    })
  );

  const results: number[][] = [];
  buffered.listen((buf) => results.push([...buf]));

  source.push(1, 2, 3, 4, 5, 6, 7, 8);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([[1], [2, 3]]); // [1]=1→emit 1, [1,2,3]=2→emit 2, then avg gets too high for available buffer size
});

test("buffer - adaptive batching", async () => {
  const events = new Stream<{ priority: "high" | "low"; data: string }>();
  const adaptiveBatches = events.pipe(
    buffer((buffer, event) => {
      // High priority events trigger immediate emission
      if (event.priority === "high") return true;
      // Low priority waits for 3 items
      return buffer.length >= 3;
    })
  );

  const results: any[][] = [];
  adaptiveBatches.listen((batch) => results.push([...batch]));

  events.push(
    { priority: "low", data: "a" },
    { priority: "low", data: "b" },
    { priority: "high", data: "urgent" },
    { priority: "low", data: "c" },
    { priority: "low", data: "d" },
    { priority: "low", data: "e" }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [
      { priority: "low", data: "a" },
      { priority: "low", data: "b" },
      { priority: "high", data: "urgent" },
    ],
    [
      { priority: "low", data: "c" },
      { priority: "low", data: "d" },
      { priority: "low", data: "e" },
    ],
  ]);
});

test("buffer - memory-aware batching", async () => {
  interface DataChunk {
    size: number;
    content: string;
  }

  const chunks = new Stream<DataChunk>();
  const memoryBatches = chunks.pipe(
    buffer(0, (totalSize, buffer, chunk) => {
      const newSize = totalSize + chunk.size;
      const maxMemory = 100;

      if (newSize >= maxMemory) {
        // Emit current batch and reset
        return [true, 0];
      }
      return [false, newSize]; // Don't emit, accumulate
    })
  );

  const results: DataChunk[][] = [];
  memoryBatches.listen((batch) => results.push([...batch]));

  chunks.push(
    { size: 30, content: "chunk1" },
    { size: 40, content: "chunk2" },
    { size: 50, content: "chunk3" }, // This triggers emission (30+40+50=120 > 100)
    { size: 20, content: "chunk4" },
    { size: 90, content: "chunk5" } // This triggers emission (20+90=110 > 100)
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    [
      { size: 30, content: "chunk1" },
      { size: 40, content: "chunk2" },
      { size: 50, content: "chunk3" },
    ],
    [
      { size: 20, content: "chunk4" },
      { size: 90, content: "chunk5" },
    ],
  ]);
});
