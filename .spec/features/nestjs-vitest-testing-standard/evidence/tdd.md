# TDD evidence

## T-171 — Codify the NestJS Vitest and TDD contract

- Red: `node --test --test-name-pattern="AC-208|AC-209" test/nestjs-vitest-testing-standard.test.mjs`
  exited 1 because `docs/standards/nestjs-vitest-testing.md` did not exist.
- Green: the same focused command exited 0 after adding the repository policy,
  constitution principle, and contributor instructions.
- Refactor: the policy contract was made whitespace-tolerant and the focused
  suite remained green (2 tests, 0 failures).

## T-172 — Install and configure shared Vitest coverage tooling

- Red: `node --test --test-name-pattern="AC-210|AC-211" test/nestjs-vitest-testing-standard.test.mjs`
  exited 1 because the Vitest configuration and Nx unit/coverage targets did
  not exist. The first coverage execution also exited 1 after revealing that
  an unrestricted source set measured the entire monorepo instead of reviewed
  production files.
- Green: policy tests passed 4/4, platform unit tests passed 2/2, and the
  platform coverage target reached 100 percent for lines, statements,
  functions, and branches on the first reviewed production file.
- Refactor: test TypeScript received its own compiler target, the aggregate Nx
  test preserves the existing contract suite, and the previously brittle exact
  target-list assertion now requires capabilities without forbidding new gates.
  Unit, coverage, production typecheck, and lint targets remained green.
