# Milestone 7 quality gate

Run the deterministic local quality gate from the repository root:

```sh
pnpm run quality:coverage
```

The target uses Node's native coverage collector with a 70 percent line floor
for the order domain and the existing Gradle test target for the payment
processor. A coverage regression below that floor fails before Gradle runs.

The same target executes the warmed buyer probe. Its P95 budget is below 500
milliseconds, and the request-scoped product and order counters must each
record one batch of all unique entity loads per probe iteration. This makes an N+1
regression fail deterministically without a load-testing dependency.
