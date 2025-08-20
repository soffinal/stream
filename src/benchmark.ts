import { Stream, State, List, Map, Set, map, filter, group, merge, flat } from ".";

interface BenchmarkResult {
  name: string;
  operations: number;
  duration: number;
  opsPerSecond: number;
  memoryUsage?: number;
}

class Benchmark {
  private results: BenchmarkResult[] = [];

  async run(name: string, operations: number, fn: () => Promise<void> | void): Promise<BenchmarkResult> {
    // Force garbage collection if available
    if (global.gc) global.gc();

    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    await fn();

    const end = performance.now();
    const memAfter = process.memoryUsage().heapUsed;

    const duration = end - start;
    const opsPerSecond = Math.round((operations / duration) * 1000);
    const memoryUsage = memAfter - memBefore;

    const result: BenchmarkResult = {
      name,
      operations,
      duration: Math.round(duration * 100) / 100,
      opsPerSecond,
      memoryUsage,
    };

    this.results.push(result);
    console.log(
      `${name}: ${opsPerSecond.toLocaleString()} ops/sec (${duration}ms, ${Math.round(memoryUsage / 1024)}KB)`
    );

    return result;
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  printSummary() {
    console.log("\n=== BENCHMARK SUMMARY ===");
    this.results.forEach((result) => {
      console.log(`${result.name.padEnd(40)} ${result.opsPerSecond.toLocaleString().padStart(10)} ops/sec`);
    });
  }
}

async function runBenchmarks() {
  const bench = new Benchmark();
  const OPERATIONS = 100_000;
  const LISTENERS = 10;

  console.log("🚀 Starting Stream Library Benchmarks...\n");

  // Basic Stream Operations
  await bench.run("Basic Push/Listen", OPERATIONS, async () => {
    const stream = new Stream<number>();
    let received = 0;

    for (let i = 0; i < LISTENERS; i++) {
      stream.listen(() => received++);
    }

    for (let i = 0; i < OPERATIONS; i++) {
      stream.push(i);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // Multiple Listeners Performance
  await bench.run("100 Listeners", OPERATIONS, async () => {
    const stream = new Stream<number>();
    let received = 0;

    for (let i = 0; i < 100; i++) {
      stream.listen(() => received++);
    }

    for (let i = 0; i < OPERATIONS; i++) {
      stream.push(i);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // Extreme Scalability Test
  await bench.run("100,000 Listeners", OPERATIONS / 10, async () => {
    const stream = new Stream<number>();
    let received = 0;

    for (let i = 0; i < 100_000; i++) {
      stream.listen(() => received++);
    }

    for (let i = 0; i < OPERATIONS / 10; i++) {
      stream.push(i);
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  // Complex Pipeline Performance
  await bench.run("Complex Pipeline", OPERATIONS, async () => {
    const stream = new Stream<number>();
    const result = stream
      .filter((x) => x > 0)
      .map((x) => x * 2)
      .filter((x) => x < 1000)
      .map((x) => x.toString())
      .filter((x) => x.length < 4);

    let received = 0;
    for (let i = 0; i < LISTENERS; i++) {
      result.listen(() => received++);
    }

    for (let i = 0; i < OPERATIONS; i++) {
      stream.push(i);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // Functional Style Performance
  await bench.run("Functional Pipeline", OPERATIONS, async () => {
    const stream = new Stream<number>();
    const result = stream
      .pipe(filter((x) => x > 0))
      .pipe(map((x) => x * 2))
      .pipe(filter((x) => x < 1000))
      .pipe(map((x) => x.toString()));

    let received = 0;
    for (let i = 0; i < LISTENERS; i++) {
      result.listen(() => received++);
    }

    for (let i = 0; i < OPERATIONS; i++) {
      stream.push(i);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // State Performance
  await bench.run("State Updates", OPERATIONS, async () => {
    const state = new State(0);
    let received = 0;

    for (let i = 0; i < LISTENERS; i++) {
      state.listen(() => received++);
    }

    for (let i = 0; i < OPERATIONS; i++) {
      state.value = i;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // Memory Stress Test
  await bench.run("Memory Stress Test", OPERATIONS * 10, async () => {
    const streams: Stream<number>[] = [];

    // Create many streams with listeners
    for (let i = 0; i < 100; i++) {
      const stream = new Stream<number>();
      stream.listen(() => {});
      streams.push(stream);
    }

    // Push lots of data
    for (let i = 0; i < OPERATIONS * 10; i++) {
      const stream = streams[i % streams.length];
      stream.push(i);
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  bench.printSummary();
  console.log("\n🎯 Benchmark Complete!");
}

// Run: bun run src/benchmark.ts
if (require.main === module) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks, Benchmark };
