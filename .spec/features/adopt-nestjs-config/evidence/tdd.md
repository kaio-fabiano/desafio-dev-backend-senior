# TDD evidence

## T-176 — Replace custom environment plumbing with NestJS Config

- Red: all three annotated tests failed before implementation because the
  application roots did not import `ConfigModule`, bootstrap ports read
  `process.env` directly, and the custom environment snapshot was public.
- Green: Gateway, Identity, and Order Workflow now register the official
  cached global `ConfigModule` once and resolve `PORT` through injected
  `ConfigService`, preserving the numeric conversion and port 3000 default.
- Refactor: the unused `PlatformConfigModule`, `ENVIRONMENT` token,
  environment snapshot factory, unit test, coverage entry, and barrel exports
  were removed. Feature-owned OAuth, database, messaging, and integration
  configuration remains unchanged for review with its owning module.
- Verification: five focused tests pass; typecheck and lint pass for all three
  applications and the shared platform library; the platform suite retains
  100% statements, lines, and functions with 98.48% branches.
