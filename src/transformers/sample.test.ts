import { test, expect } from "bun:test";
import { Stream } from "../stream.ts";
import { sample } from "./sample.ts";

test("sample - trigger based", async () => {
  const source = new Stream<number>();
  const trigger = new Stream<void>();
  const sampled = source.pipe(sample(trigger));

  const results: number[] = [];
  sampled.listen((value) => results.push(value));

  source.push(1, 2, 3);
  trigger.push(); // Should sample current value (3)

  source.push(4, 5);
  trigger.push(); // Should sample current value (5)

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([3, 5]);
});

test("sample - interval based", async () => {
  const source = new Stream<number>();
  const sampled = source.pipe(sample(50)); // Sample every 50ms

  const results: number[] = [];
  const timestamps: number[] = [];
  
  sampled.listen((value) => {
    results.push(value);
    timestamps.push(Date.now());
  });

  const start = Date.now();
  
  // Push initial value
  source.push(1);
  
  // Update values rapidly
  setTimeout(() => source.push(2), 10);
  setTimeout(() => source.push(3), 20);
  setTimeout(() => source.push(4), 30);
  setTimeout(() => source.push(5), 70); // After first sample
  setTimeout(() => source.push(6), 80);

  await new Promise((resolve) => setTimeout(resolve, 120));

  // Should sample at ~50ms and ~100ms intervals
  expect(results).toEqual([4, 6]); // Latest values at each interval
  expect(timestamps.length).toBe(2);
  expect(timestamps[0] - start).toBeGreaterThanOrEqual(45);
  expect(timestamps[0] - start).toBeLessThan(60);
  expect(timestamps[1] - start).toBeGreaterThanOrEqual(95);
  expect(timestamps[1] - start).toBeLessThan(110);
});

test("sample - predicate based", async () => {
  const source = new Stream<number>();
  const sampled = source.pipe(sample((value, lastSampled) => {
    // Sample when value increases by 5 or more
    return lastSampled === undefined || value - lastSampled >= 5;
  }));

  const results: number[] = [];
  sampled.listen((value) => results.push(value));

  source.push(1, 2, 3, 6, 7, 8, 12, 13, 20);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1, 6, 12, 20]); // 1 (first), 6 (1+5), 12 (6+6≥5), 20 (12+8≥5)
});

test("sample - dynamic interval", async () => {
  const source = new Stream<number>();
  const sampled = source.pipe(sample((value) => value * 10)); // Interval based on value

  const results: number[] = [];
  const timestamps: number[] = [];
  
  sampled.listen((value) => {
    results.push(value);
    timestamps.push(Date.now());
  });

  const start = Date.now();
  
  source.push(2); // 20ms interval
  setTimeout(() => source.push(3), 10); // 30ms interval  
  setTimeout(() => source.push(5), 25); // 50ms interval
  setTimeout(() => source.push(1), 80); // 10ms interval

  await new Promise((resolve) => setTimeout(resolve, 100));

  // Should sample based on dynamic intervals
  expect(results.length).toBeGreaterThan(0);
  expect(results[0]).toBe(2); // First value always sampled
});

test("sample - stateful sampling", async () => {
  const source = new Stream<number>();
  const sampled = source.pipe(sample(
    { count: 0, threshold: 3 },
    (state, value, lastSampled) => {
      const newCount = state.count + 1;
      const shouldSample = newCount >= state.threshold;
      
      return [
        shouldSample,
        shouldSample ? { count: 0, threshold: state.threshold } : { ...state, count: newCount }
      ];
    }
  ));

  const results: number[] = [];
  sampled.listen((value) => results.push(value));

  source.push(1, 2, 3, 4, 5, 6, 7, 8, 9);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([3, 6, 9]); // Every 3rd value
});

test("sample - no values before trigger", async () => {
  const source = new Stream<number>();
  const trigger = new Stream<void>();
  const sampled = source.pipe(sample(trigger));

  const results: number[] = [];
  sampled.listen((value) => results.push(value));

  trigger.push(); // No values yet
  
  source.push(1);
  trigger.push(); // Should sample 1

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([1]); // Only one sample
});

test("sample - interval with no initial value", async () => {
  const source = new Stream<number>();
  const sampled = source.pipe(sample(30));

  const results: number[] = [];
  sampled.listen((value) => results.push(value));

  // Wait for first interval - should not emit anything
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(results).toEqual([]);

  // Push value and wait for next interval
  source.push(42);
  await new Promise((resolve) => setTimeout(resolve, 40));
  
  expect(results).toEqual([42]);
});

test("sample - real-world: mouse position sampling", async () => {
  interface MousePosition {
    x: number;
    y: number;
    timestamp: number;
  }

  const mouseEvents = new Stream<MousePosition>();
  const sampledPositions = mouseEvents.pipe(sample(16)); // ~60fps sampling

  const results: MousePosition[] = [];
  sampledPositions.listen((pos) => results.push(pos));

  const now = Date.now();
  
  // Simulate rapid mouse movements
  mouseEvents.push({ x: 10, y: 10, timestamp: now });
  mouseEvents.push({ x: 15, y: 12, timestamp: now + 2 });
  mouseEvents.push({ x: 20, y: 15, timestamp: now + 4 });
  mouseEvents.push({ x: 25, y: 18, timestamp: now + 6 });

  await new Promise((resolve) => setTimeout(resolve, 25));

  // Should sample the latest position at 16ms interval
  expect(results.length).toBe(1);
  expect(results[0].x).toBe(25); // Latest x position
  expect(results[0].y).toBe(18); // Latest y position
});

test("sample - real-world: sensor data with adaptive sampling", async () => {
  interface SensorReading {
    value: number;
    variance: number;
  }

  const sensorData = new Stream<SensorReading>();
  const adaptiveSampled = sensorData.pipe(sample((reading, lastSampled) => {
    // Sample more frequently when variance is high
    if (lastSampled === undefined) return true;
    
    const varianceThreshold = 0.1;
    const significantChange = Math.abs(reading.value - lastSampled.value) > varianceThreshold;
    const highVariance = reading.variance > 0.5;
    
    return significantChange || highVariance;
  }));

  const results: SensorReading[] = [];
  adaptiveSampled.listen((reading) => results.push(reading));

  sensorData.push(
    { value: 1.0, variance: 0.05 }, // First sample
    { value: 1.01, variance: 0.05 }, // Small change, low variance - skip
    { value: 1.02, variance: 0.05 }, // Small change, low variance - skip  
    { value: 1.15, variance: 0.05 }, // Significant change - sample
    { value: 1.16, variance: 0.8 },  // High variance - sample
    { value: 1.17, variance: 0.05 }  // Low variance, small change - skip
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(results).toEqual([
    { value: 1.0, variance: 0.05 },  // First
    { value: 1.15, variance: 0.05 }, // Significant change
    { value: 1.16, variance: 0.8 }   // High variance
  ]);
});