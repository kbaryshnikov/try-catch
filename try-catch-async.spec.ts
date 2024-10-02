import { catchAll, except, finallyDo, tryAsync } from './try-catch'

class ErrorA extends Error {
  public a = 'error_a'
}

class ErrorB extends ErrorA {
  public b = 'error_b'
}

class OtherError extends Error {}

const maybeThrows = async <T>(value: T, e?: any): Promise<T> => {
  if (e) {
    throw e
  }
  return value
}

describe('tryAsync', () => {
  it('returns result if no exceptions thrown', async () => {
    const result: string = await tryAsync(async () => maybeThrows('ok'))
    expect(result).toEqual('ok')
  })
  it('catches exceptions by constructor type', async () => {
    const result = await tryAsync<string | { a: string; b: string; type: string }>(
      async () => maybeThrows('never', new ErrorB()),
      except(ErrorB, (e) => ({ a: e.a, b: e.b, type: e.constructor.name })),
    )
    if (typeof result === 'string') throw new Error('failed')
    expect(result.a).toEqual('error_a')
    expect(result.b).toEqual('error_b')
    expect(result.type).toEqual('ErrorB')
  })
  it('supports async exception handlers', async () => {
    const result = await tryAsync(
      async () => maybeThrows('never', new ErrorB()),
      except(ErrorB, async (e) => Promise.resolve(e.b)),
    )
    expect(result).toEqual('error_b')
  })
  it('catches exceptions by hierarchy', async () => {
    const result: string = await tryAsync(
      async () => maybeThrows('never', new ErrorA()),
      except(ErrorB, (e) => e.b),
      except(ErrorA, (e) => e.a)
    )
    expect(result).toEqual('error_a')

    const result2: string = await tryAsync(
      async () => maybeThrows('never', new ErrorB()),
      except(ErrorB, (e) => e.b),
      except(ErrorA, (e) => e.a)
    )
    expect(result2).toEqual('error_b')

    const result3: string = await tryAsync(
      async () => maybeThrows('never', new ErrorB()),
      except(ErrorA, (e) => e.a)
    )
    expect(result3).toEqual('error_a')

    const result4: string = await tryAsync(
      async () => maybeThrows('never', new OtherError()),
      except(Error, (e) => e.constructor.name)
    )
    expect(result4).toEqual('OtherError')
  })
  it('rethrows unhandled exceptions', async () => {
    const test = async () => {
      await tryAsync(
        async () => maybeThrows('never', new OtherError()),
        except(ErrorA, (e) => e.a)
      )
    }
    await expect(test).rejects.toThrow(OtherError)
  })
  it('catches any type with catchAll', async () => {
    const result: string = await tryAsync(
      async () => maybeThrows('never', 'string_error'),
      catchAll((e) => `${e}`)
    )
    expect(result).toEqual('string_error')
  })
  it('finally invokes finallyDo()', async () => {
    let finallyCalled = false
    const result: string = await tryAsync<string>(
      () => maybeThrows('ok'),
      except(ErrorA, (e) => e.a),
      finallyDo(() => {
        finallyCalled = true
      })
    )
    expect(result).toEqual('ok')
    expect(finallyCalled).toBeTruthy()

    let finallyCalled2 = false
    const result2: string = await tryAsync<string>(
      () => maybeThrows('never', new ErrorA()),
      except(ErrorA, (e) => e.a),
      finallyDo(() => {
        finallyCalled2 = true
      })
    )
    expect(result2).toEqual('error_a')
    expect(finallyCalled2).toBeTruthy()
  })
  it('handles multiple types in one handler', async () => {
    const result: string = await tryAsync(
      async () => maybeThrows('never', new ErrorA()),
      except([ErrorA, OtherError], (e): string => e.constructor.name),
    )
    expect(result).toEqual('ErrorA')
    const result2: string = await tryAsync(
      async () => maybeThrows('never', new OtherError()),
      except([ErrorA, OtherError], (e): string => e.constructor.name),
    )
    expect(result2).toEqual('OtherError')
  })
})