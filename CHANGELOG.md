# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2024-12-19

### Changed

- **BREAKING**: Removed instance methods for transformers from Stream class - use `.pipe()` exclusively
- **BREAKING**: filte and map transformers signatures now require state-based accumulators instead of simple sync/async predicates
- Improved internal transformer implementation

## [0.1.4] - 2024-12-18

[Unreleased]: https://github.com/soffinal/stream/compare/v0.1.4...HEAD
[0.2.0]: https://github.com/soffinal/stream/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/soffinal/stream/releases/tag/v0.1.4
