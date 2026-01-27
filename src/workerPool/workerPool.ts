/**
 * Shared worker pool for efficient resource management
 * Reuses workers across multiple streams
 */

import { Stream } from "../stream.ts";

type Task<T, U> = {
  id: string;
  fn: string;
  value: T;
  args?: any;
  resolve: (result: U) => void;
  reject: (error: Error) => void;
};

class WorkerPoolManager {
  private static instance: WorkerPoolManager;
  private workers: Worker[] = [];
  private pendingTasks = new Map<string, Task<any, any>>();
  private taskCounter = 0;
  private fnCounter = 0;

  private constructor() {}

  static getInstance(): WorkerPoolManager {
    if (!WorkerPoolManager.instance) {
      WorkerPoolManager.instance = new WorkerPoolManager();
    }
    return WorkerPoolManager.instance;
  }

  private createWorker(): Worker {
    const workerCode = `
      const functions = new Map();
      
      self.onmessage = async (e) => {
        const { type, fnId, fnString, args, taskId, value } = e.data;
        
        if (type === 'register') {
          const fn = eval(\`(\${fnString})\`);
          functions.set(fnId, { fn, args });
          return;
        }
        
        if (type === 'execute') {
          try {
            const { fn, args } = functions.get(fnId);
            const result = await fn(value, args);
            self.postMessage({ taskId, result });
          } catch (error) {
            self.postMessage({ taskId, error: error.message });
          }
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e) => {
      const { taskId, result, error } = e.data;
      const task = this.pendingTasks.get(taskId);

      if (task) {
        this.pendingTasks.delete(taskId);
        if (error) {
          task.reject(new Error(error));
        } else {
          task.resolve(result);
        }
      }
    };

    worker.onerror = (e) => {
      console.error("Worker error:", e);
    };

    return worker;
  }

  private getWorker(): Worker {
    const config = Stream.getConfig();
    if (this.workers.length < config.workerPoolSize) {
      const worker = this.createWorker();
      this.workers.push(worker);
      return worker;
    }
    // Round-robin selection
    return this.workers[this.taskCounter % this.workers.length];
  }

  register<T, U>(fn: (value: T, args?: any) => U | Promise<U>, args?: any) {
    const fnId = `fn-${this.fnCounter++}`;
    const fnString = fn.toString();

    // Register in all workers
    this.workers.forEach((w) => {
      w.postMessage({ type: "register", fnId, fnString, args });
    });

    return {
      fnId,
      execute: (value: T) => this.executeById<T, U>(fnId, value),
    };
  }

  private executeById<T, U>(fnId: string, value: T): Promise<U> {
    const taskId = `task-${this.taskCounter++}`;
    const worker = this.getWorker();

    return new Promise<U>((resolve, reject) => {
      this.pendingTasks.set(taskId, { id: taskId, fn: "", value, resolve, reject });
      worker.postMessage({ type: "execute", fnId, taskId, value });
    });
  }

  async execute<T, U>(fn: (value: T, args?: any) => U | Promise<U>, value: T, args?: any): Promise<U> {
    const taskId = `task-${this.taskCounter++}`;
    const fnString = fn.toString();
    const worker = this.getWorker();

    return new Promise<U>((resolve, reject) => {
      this.pendingTasks.set(taskId, { id: taskId, fn: fnString, value, args, resolve, reject });
      worker.postMessage({ taskId, fnString, value, args });
    });
  }

  terminate() {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.pendingTasks.clear();
  }
}

export const WorkerPool = WorkerPoolManager.getInstance();
