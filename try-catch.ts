type MaybePromise<T> = T | Promise<T>

interface ErrorConstructor<E extends Error = Error> {
  new(...args: unknown[]): E
}

interface TryCatchHandlers<T> {
  catch: Map<ErrorConstructor, (e: Error, context: object) => T>
  catchAll?: (e: unknown, context: object) => T
  finally?: (result: T | undefined, context: object) => void | Promise<void>
}

export interface CatchHandler<T, E extends Error = Error> {
  type: 'catch'
  errCtor: ErrorConstructor<E>
  handler: (e: E, context: object) => T
}

export interface CatchAllHandler<T> {
  type: 'catchAll'
  handler: (e: unknown, context: object) => T
}

export interface FinallyHandler<T> {
  type: 'finally'
  handler: (result: T | undefined, context: object) => void | Promise<void>
}

type TryCatchHandler<T> = CatchHandler<T> | CatchAllHandler<T> | FinallyHandler<T>

const buildHandlersMap= <T>(...args: (TryCatchHandler<T> | TryCatchHandler<T>[])[]): TryCatchHandlers<T> => (
  Array.prototype.concat.apply([], args).reduce((acc: TryCatchHandlers<T>, item: TryCatchHandler<T>) => {
    switch (item.type) {
      case 'catch':
        acc.catch.set(item.errCtor, item.handler)
        return acc
      case 'catchAll':
        acc.catchAll = item.handler
        return acc
      case 'finally':
        acc.finally = item.handler
        return acc
    }
  }, { catch: new Map() })
)

const findHandler = <T>(
  catchHandlers: Map<ErrorConstructor, (e: Error, context: object) => T>,
  proto: ErrorConstructor,
): undefined | ((e: Error, context: object) => T) => {
  let prevProto: ErrorConstructor | null = null
  while (proto && proto !== prevProto) {
    const handler = catchHandlers.get(proto)
    if (handler) {
      return handler
    }
    if (proto === Error) {
      return
    }
    prevProto = proto
    proto = Object.getPrototypeOf(proto)
  }
}

export const except = <T, E extends Error>(
  errCtor: ErrorConstructor<E> | ErrorConstructor<E>[],
  handler: CatchHandler<T, E>['handler'],
): CatchHandler<T> | Array<CatchHandler<T>> => (
  Array.isArray(errCtor)
    ? errCtor.map(e => ({ type: 'catch', errCtor: e, handler }))
    : { type: 'catch', errCtor, handler }
)

export const catchAll = <T>(handler: CatchAllHandler<T>['handler']): CatchAllHandler<T> => (
  { type: 'catchAll', handler }
)

export const finallyDo = <T>(handler: FinallyHandler<T>['handler']): FinallyHandler<T> => (
  { type: 'finally', handler }
)

const handleError = <T>(map: TryCatchHandlers<T>, e: unknown, context: object): T => {
  let handler
  if (e instanceof Error && undefined !== (handler = findHandler<T>(map.catch, <ErrorConstructor>e.constructor))) {
    return handler(e, context)
  } else if (map.catchAll) {
    return map.catchAll(e, context)
  } else {
    throw e
  }
}

export const trySync = <T>(
  doFn: (context: object) => T,
  ...args: (TryCatchHandler<T> | Array<TryCatchHandler<T>>)[]
): T => {
  const map = buildHandlersMap(...args)
  const context = {}
  let result: T | undefined
  try {
    result = doFn(context)
    return result
  } catch (e) {
    return handleError<T>(map, e, context)
  } finally {
    map.finally && map.finally(result, context)
  }
}

export const tryAsync = async <T>(
  doFn: (context: object) => Promise<T>,
  ...args: (TryCatchHandler<MaybePromise<T>> | Array<TryCatchHandler<MaybePromise<T>>>)[]
): Promise<T> => {
  const map = buildHandlersMap(...args)
  const context = {}
  let result: T | undefined
  try {
    result = await doFn(context)
    return result
  } catch (e) {
    return Promise.resolve(handleError<MaybePromise<T>>(map, e, context))
  } finally {
    map.finally && await map.finally(result, context)
  }
}
