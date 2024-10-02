import { catchAll, except, finallyDo, trySync } from './try-catch'

class ErrorA extends Error {
  public a = 'error_a'
}

class ErrorB extends ErrorA {
  public b = 'error_b'
}

class OtherError extends Error {}

const maybeThrows = <T>(value: T, e?: any): T => {
  if (e) {
    throw e
  }
  return value
}

describe('trySync', () => {
  it('returns result if no exceptions thrown', () => {
    const result: string = trySync(() => maybeThrows('ok'))
    expect(result).toEqual('ok')
  })
  it('catches exceptions by constructor type', () => {
    const result = trySync<string | { a: string; b: string; type: string }>(
      () => maybeThrows('never', new ErrorB()),
      except(ErrorB, (e) => ({ a: e.a, b: e.b, type: e.constructor.name })),
    )
    if (typeof result === 'string') throw new Error('failed')
    expect(result.a).toEqual('error_a')
    expect(result.b).toEqual('error_b')
    expect(result.type).toEqual('ErrorB')
  })
  it('catches exceptions by hierarchy', () => {
    const result: string = trySync(
      () => maybeThrows('never', new ErrorA()),
      except(ErrorB, (e) => e.b),
      except(ErrorA, (e) => e.a)
    )
    expect(result).toEqual('error_a')

    const result2: string = trySync(
      () => maybeThrows('never', new ErrorB()),
      except(ErrorB, (e) => e.b),
      except(ErrorA, (e) => e.a)
    )
    expect(result2).toEqual('error_b')

    const result3: string = trySync(
      () => maybeThrows('never', new ErrorB()),
      except(ErrorA, (e) => e.a)
    )
    expect(result3).toEqual('error_a')

    const result4: string = trySync(
      () => maybeThrows('never', new OtherError()),
      except(Error, (e) => e.constructor.name)
    )
    expect(result4).toEqual('OtherError')
  })
  it('rethrows unhandled exceptions', () => {
    const test = () => {
      trySync(
        () => maybeThrows('never', new OtherError()),
        except(ErrorA, (e) => e.a)
      )
    }
    expect(test).toThrow(OtherError)
  })
  it('catches any type with catchAll', () => {
    const result: string = trySync(
      () => maybeThrows('never', 'string_error'),
      catchAll((e) => `${e}`)
    )
    expect(result).toEqual('string_error')
  })
  it('finally invokes finallyDo()', () => {
    let finallyCalled = false
    const result: string = trySync<string>(
      () => maybeThrows('ok'),
      except(ErrorA, (e) => e.a),
      finallyDo(() => {
        finallyCalled = true
      })
    )
    expect(result).toEqual('ok')
    expect(finallyCalled).toBeTruthy()

    let finallyCalled2 = false
    const result2: string = trySync<string>(
      () => maybeThrows('never', new ErrorA()),
      except(ErrorA, (e) => e.a),
      finallyDo(() => {
        finallyCalled2 = true
      })
    )
    expect(result2).toEqual('error_a')
    expect(finallyCalled2).toBeTruthy()
  })
  it('handles multiple types in one handler', () => {
    const result: string = trySync(
      () => maybeThrows('never', new ErrorA()),
      except([ErrorA, OtherError], (e): string => e.constructor.name),
    )
    expect(result).toEqual('ErrorA')
    const result2: string = trySync(
      () => maybeThrows('never', new OtherError()),
      except([ErrorA, OtherError], (e): string => e.constructor.name),
    )
    expect(result2).toEqual('OtherError')
  })
})