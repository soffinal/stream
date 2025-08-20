# Contributing to @soffinal/stream

We welcome contributions to @soffinal/stream! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Code Style](#code-style)
- [Performance Guidelines](#performance-guidelines)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- **Node.js** 16+ or **Bun** 1.0+
- **Git**
- **TypeScript** knowledge

### Development Setup

1. **Fork and clone the repository:**

```bash
git clone https://github.com/YOUR_USERNAME/stream.git
cd stream
```

2. **Install dependencies:**

```bash
bun install
# or
npm install
```

3. **Build the project:**

```bash
bun run build
```

4. **Run tests:**

```bash
bun test
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-debounce-transformer`
- `fix/memory-leak-in-listeners`
- `docs/improve-api-examples`
- `perf/optimize-filter-performance`

### Commit Messages

Follow conventional commits format:

```
type(scope): description

feat(stream): add debounce transformer
fix(state): resolve memory leak in cleanup
docs(readme): add custom transformer examples
perf(filter): optimize predicate evaluation
```

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/stream.test.ts

# Run tests in watch mode
bun test --watch
```

### Writing Tests

- **Unit tests** for all new features
- **Integration tests** for complex workflows
- **Performance tests** for optimizations
- **Type tests** for TypeScript features

Example test structure:

```typescript
import { describe, it, expect } from "bun:test";
import { Stream } from "./stream";

describe("Stream", () => {
  it("should emit values to listeners", () => {
    const stream = new Stream<number>();
    const values: number[] = [];

    stream.listen((value) => values.push(value));
    stream.push(1, 2, 3);

    expect(values).toEqual([1, 2, 3]);
  });
});
```

## Code Style

### TypeScript Guidelines

- **Strict mode** enabled
- **Explicit return types** for public APIs
- **Generic constraints** where appropriate
- **JSDoc comments** for public methods

### Example Code Style

```typescript
/**
 * Creates a new stream that filters values based on a predicate.
 * @param predicate Function to test each value
 * @returns New filtered stream
 */
filter<U extends T>(predicate: (value: T) => value is U): Stream<U>;
filter(predicate: (value: T) => boolean): Stream<T>;
filter(predicate: (value: T) => boolean): Stream<T> {
  return new Stream<T>(async function* () {
    for await (const value of this) {
      if (predicate(value)) {
        yield value;
      }
    }
  });
}
```

## Performance Guidelines

### Benchmarking

Run benchmarks before and after changes:

```bash
bun run src/benchmark.ts
```

### Performance Requirements

- **No performance regressions** in existing functionality
- **Benchmark new features** with realistic workloads
- **Memory usage** should remain constant or improve

## Submitting Changes

### Pull Request Process

1. **Create feature branch** from `main`
2. **Make your changes** with tests
3. **Update documentation** if needed
4. **Run full test suite**
5. **Submit pull request**

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Performance improvement
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Performance benchmarks run

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

- **Automated checks** must pass
- **Code review** by maintainers
- **Performance review** for optimizations
- **Documentation review** for API changes

## Types of Contributions

### Bug Fixes

- **Reproduce the issue** with a test case
- **Fix the root cause** not just symptoms
- **Add regression tests**

### New Features

- **Discuss in issues** before implementing
- **Follow existing patterns**
- **Add comprehensive tests**
- **Update documentation**

### Performance Improvements

- **Benchmark before/after**
- **Maintain API compatibility**
- **Document performance characteristics**

### Documentation

- **Clear examples** with real use cases
- **API documentation** with JSDoc
- **Migration guides** for breaking changes

## Custom Transformers

When contributing new transformers:

### Design Principles

- **Composable** with other transformers
- **Type-safe** with proper generics
- **Memory efficient** with cleanup
- **Both paradigms** - fluent and functional

### Example Transformer

```typescript
/**
 * Debounces stream values by specified delay.
 */
export const debounce =
  <T>(ms: number) =>
  (stream: Stream<T>): Stream<T> => {
    return new Stream<T>(async function* () {
      let timeoutId: Timer | null = null;
      let lastValue: T;
      let hasValue = false;

      for await (const value of stream) {
        lastValue = value;
        hasValue = true;

        if (timeoutId) clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
          if (hasValue) {
            this.push(lastValue);
            hasValue = false;
          }
        }, ms);
      }
    });
  };
```

## Getting Help

- **GitHub Issues** for bugs and feature requests
- **GitHub Discussions** for questions and ideas
- **Discord** (link in README) for real-time chat

## Recognition

Contributors will be:

- **Listed in CONTRIBUTORS.md**
- **Mentioned in release notes**
- **Credited in documentation**

Thank you for contributing to @soffinal/stream! 🚀
