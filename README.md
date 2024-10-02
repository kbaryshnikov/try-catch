Intention:

Solve the TypeScript problem with handling exceptions by type

Usage:

* trySync for sync functions
* tryAsync for async functions

Example:

```typescript
class ErrorA extends Error {
}

class ErrorB extends ErrorA {
}

class OtherError extends Error {
}

/** @throws {ErrorB|OtherError} */
async function someFunctionThatThrows() {
  /* ... */
}

const result = await tryAsync(
  async () => someFunctionThatThrows(),
  except(ErrorA, (e) => {
    /* handle e: ErrorA (including children like ErrorB) */
  }),
  except(OtherError, async (e) => {
    /* handle e: OtherError */
    /* with tryAsync, handlers can be async */
  }),
  except(Error, (e) => {
    /* handle any Error */
  }),
  catchAll((e) => {
    /* handle anything else thrown */
  }),
  finallyDo(() => {
    /* finally */
  }),
)
```
