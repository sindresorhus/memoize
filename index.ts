import mimicFunction from 'mimic-function';

type AnyFunction = (...arguments_: readonly any[]) => unknown;
type Timer = ReturnType<typeof setTimeout>;

const maxTimeoutValue = 2_147_483_647;

const cacheStore = new WeakMap<AnyFunction, CacheLike<unknown, unknown>>();
const cacheTimerStore = new WeakMap<AnyFunction, Set<Timer>>();
const cacheKeyStore = new WeakMap<AnyFunction, (arguments_: readonly any[]) => unknown>();

declare const memoizedBrand: unique symbol;

/**
A function that has been verified as memoized by `isMemoized()`.

Use it to accept only memoized functions. Since `memoize()` mimics the given function entirely, the only way to get this type is through the `isMemoized()` guard.

@example
```
import memoize, {isMemoized, type Memoized} from 'memoize';

const use = (function_: Memoized<(text: string) => boolean>) => function_('foo');

const memoized = memoize((text: string) => Boolean(text));

if (isMemoized(memoized)) {
	use(memoized);
}
```
*/
export type Memoized<FunctionToMemoize extends AnyFunction> = FunctionToMemoize & {readonly [memoizedBrand]: true};

export type CacheItem<ValueType> = {
	data: ValueType;
	maxAge: number;
};

export type CacheLike<KeyType, ValueType> = {
	get: (key: KeyType) => CacheItem<ValueType> | undefined;
	set: (key: KeyType, value: CacheItem<ValueType>) => void;
	delete: (key: KeyType) => void;
	clear?: () => void;
};

export type Options<
	FunctionToMemoize extends AnyFunction,
	CacheKeyType,
> = {
	/**
	Milliseconds until the cache entry expires.

	If a function is provided, it receives the arguments and must return the max age.

	- `0` or negative values: Do not cache the result
	- `Infinity`: Cache indefinitely (no expiration)
	- Positive finite number: Cache for the specified milliseconds

	@default Infinity
	*/
	readonly maxAge?: number | ((...arguments_: Parameters<FunctionToMemoize>) => number);

	/**
	Determines the cache key for storing the result based on the function arguments. By default, __only the first argument is considered__ and it only works with [primitives](https://developer.mozilla.org/en-US/docs/Glossary/Primitive).

	A `cacheKey` function can return any type supported by `Map` (or whatever structure you use in the `cache` option).

	You can have it cache **all** the arguments by value with `JSON.stringify`, if they are compatible:

	```
	import memoize from 'memoize';

	memoize(function_, {cacheKey: JSON.stringify});
	```

	Or you can use a more full-featured serializer like [serialize-javascript](https://github.com/yahoo/serialize-javascript) to add support for `RegExp`, `Date` and so on.

	```
	import memoize from 'memoize';
	import serializeJavascript from 'serialize-javascript';

	memoize(function_, {cacheKey: serializeJavascript});
	```

	@default arguments_ => arguments_[0]
	@example arguments_ => JSON.stringify(arguments_)
	*/
	readonly cacheKey?: (arguments_: Parameters<FunctionToMemoize>) => CacheKeyType;

	/**
	Use a different cache storage. Must implement the following methods: `.get(key)`, `.set(key, value)`, `.delete(key)`, and optionally `.clear()`. You could for example use a `WeakMap` instead or [`quick-lru`](https://github.com/sindresorhus/quick-lru) for a LRU cache.

	@default new Map()
	@example new WeakMap()
	*/
	readonly cache?: CacheLike<CacheKeyType, ReturnType<FunctionToMemoize>>;
};

function getValidCacheItem<KeyType, ValueType>(
	cache: CacheLike<KeyType, ValueType>,
	key: KeyType,
): CacheItem<ValueType> | undefined {
	const item = cache.get(key);
	if (!item) {
		return undefined;
	}

	if (item.maxAge <= Date.now()) {
		cache.delete(key);
		return undefined;
	}

	return item;
}

function validateMaxAge(value: number, source: '`maxAge` option' | '`maxAge` function result'): void {
	if (value === Number.POSITIVE_INFINITY) {
		return;
	}

	if (!Number.isFinite(value)) {
		if (source === '`maxAge` option') {
			throw new TypeError('The `maxAge` option must be a finite number, `0`, or `Infinity`.');
		}

		throw new TypeError('The `maxAge` function must return a finite number, `0`, or `Infinity`.');
	}

	if (value > maxTimeoutValue) {
		if (source === '`maxAge` option') {
			throw new TypeError(`The \`maxAge\` option cannot exceed ${maxTimeoutValue}.`);
		}

		throw new TypeError(`The \`maxAge\` function result cannot exceed ${maxTimeoutValue}.`);
	}
}

function getPropertyDescriptor(object: WeakKey, property: string | symbol): PropertyDescriptor | undefined {
	let currentObject: WeakKey | undefined = object;

	while (currentObject) {
		const descriptor = Object.getOwnPropertyDescriptor(currentObject, property);
		if (descriptor) {
			return descriptor;
		}

		currentObject = (Object.getPrototypeOf(currentObject) ?? undefined) as WeakKey | undefined;
	}

	return undefined;
}

/**
[Memoize](https://en.wikipedia.org/wiki/Memoization) functions - An optimization used to speed up consecutive function calls by caching the result of calls with identical input.

@param function_ - The function to be memoized.

@example
```
import memoize from 'memoize';

let index = 0;
const counter = () => ++index;
const memoized = memoize(counter);

memoized('foo');
//=> 1

// Cached as it's the same argument
memoized('foo');
//=> 1

// Not cached anymore as the arguments changed
memoized('bar');
//=> 2

memoized('bar');
//=> 2
```
*/
export default function memoize<
	FunctionToMemoize extends AnyFunction,
	CacheKeyType,
>(
	function_: FunctionToMemoize,
	{
		cacheKey,
		cache = new Map(),
		maxAge,
	}: Options<FunctionToMemoize, CacheKeyType> = {},
): FunctionToMemoize {
	if (typeof maxAge === 'number') {
		validateMaxAge(maxAge, '`maxAge` option');
		if (maxAge <= 0) {
			return function_;
		}
	}

	const memoized = function (this: any, ...arguments_: Parameters<FunctionToMemoize>): ReturnType<FunctionToMemoize> {
		const key = cacheKey ? cacheKey(arguments_) : arguments_[0] as CacheKeyType;

		const cacheItem = getValidCacheItem(cache, key);
		if (cacheItem) {
			return cacheItem.data;
		}

		const result = function_.apply(this, arguments_) as ReturnType<FunctionToMemoize>;

		const computedMaxAge = typeof maxAge === 'function' ? maxAge(...arguments_) : maxAge;
		if (computedMaxAge !== undefined && computedMaxAge !== Number.POSITIVE_INFINITY) {
			validateMaxAge(computedMaxAge, '`maxAge` function result');

			if (computedMaxAge <= 0) {
				return result; // Do not cache
			}
		}

		cache.set(key, {
			data: result,
			maxAge: (computedMaxAge === undefined || computedMaxAge === Number.POSITIVE_INFINITY)
				? Number.POSITIVE_INFINITY
				: Date.now() + computedMaxAge,
		});

		if (computedMaxAge !== undefined && computedMaxAge !== Number.POSITIVE_INFINITY) {
			const timer = setTimeout(() => {
				cache.delete(key);
				cacheTimerStore.get(memoized)?.delete(timer);
			}, computedMaxAge);

			(timer as any).unref?.();

			const timers = cacheTimerStore.get(memoized) ?? new Set<Timer>();
			timers.add(timer);
			cacheTimerStore.set(memoized, timers);
		}

		return result;
	} as FunctionToMemoize;

	mimicFunction(memoized, function_, {
		ignoreNonConfigurable: true,
	});

	cacheStore.set(memoized, cache as CacheLike<unknown, unknown>);
	cacheKeyStore.set(memoized, (cacheKey ?? ((arguments_: readonly any[]) => arguments_[0])) as (arguments_: readonly any[]) => unknown);

	return memoized;
}

/**
@returns A [decorator](https://github.com/tc39/proposal-decorators) to memoize class methods, static class methods, or getters.

@example
```
import {memoizeDecorator} from 'memoize';

class Example {
	index = 0

	@memoizeDecorator()
	counter() {
		return ++this.index;
	}
}

class ExampleWithOptions {
	index = 0

	@memoizeDecorator({maxAge: 1000})
	counter() {
		return ++this.index;
	}
}

class ExampleWithGetter {
	@memoizeDecorator()
	get value() {
		return expensiveComputation();
	}
}
```
*/
export function memoizeDecorator<
	FunctionToMemoize extends AnyFunction,
	CacheKeyType,
>(options: Options<FunctionToMemoize, CacheKeyType> = {}) {
	function decorator<This, ArgumentsType extends readonly unknown[], ReturnValueType>(
		target: (this: This, ...arguments_: ArgumentsType) => ReturnValueType,
		context: ClassMethodDecoratorContext<This, (this: This, ...arguments_: ArgumentsType) => ReturnValueType>,
	): (this: This, ...arguments_: ArgumentsType) => ReturnValueType;
	function decorator<This, ReturnValueType>(
		target: (this: This) => ReturnValueType,
		context: ClassGetterDecoratorContext<This, ReturnValueType>,
	): (this: This) => ReturnValueType;
	function decorator(
		target: AnyFunction,
		context: ClassMethodDecoratorContext | ClassGetterDecoratorContext,
	) {
		if (context.kind === 'method') {
			if (context.private) {
				throw new TypeError('The `memoizeDecorator` method decorator does not support private methods.');
			}

			const memoizedMethods = new WeakMap<WeakKey, FunctionToMemoize>();

			const getMemoizedMethod = (receiver: WeakKey): FunctionToMemoize => {
				let memoizedMethod = memoizedMethods.get(receiver);
				if (!memoizedMethod) {
					memoizedMethod = memoize(target.bind(receiver) as FunctionToMemoize, options);
					memoizedMethods.set(receiver, memoizedMethod);
				}

				return memoizedMethod;
			};

			const installMethod = (receiver: Record<string | symbol, unknown>, method: FunctionToMemoize): FunctionToMemoize => {
				Object.defineProperty(receiver, context.name, {
					configurable: true,
					enumerable: false,
					value: method,
					writable: true,
				});

				return method;
			};

			const installStaticMethodGetter = (receiver: Record<string | symbol, unknown> & WeakKey): void => {
				Object.defineProperty(receiver, context.name, {
					configurable: true,
					enumerable: false,
					get() {
						const currentReceiver = this as Record<string | symbol, unknown> & WeakKey;
						if (currentReceiver !== receiver) {
							const currentPrototype: unknown = Object.getPrototypeOf(currentReceiver);
							if (
								currentPrototype === receiver
								&& !Object.hasOwn(currentReceiver, context.name)
							) {
								installStaticMethodGetter(currentReceiver);
							}
						}

						return getMemoizedMethod(currentReceiver);
					},
				});
			};

			const decoratedMethod = function (this: WeakKey, ...arguments_: Parameters<FunctionToMemoize>): ReturnType<FunctionToMemoize> {
				return getMemoizedMethod(this)(...arguments_) as ReturnType<FunctionToMemoize>;
			} as FunctionToMemoize;

			mimicFunction(decoratedMethod, target, {
				ignoreNonConfigurable: true,
			});

			if (context.static) {
				context.addInitializer(function () {
					installStaticMethodGetter(this as Record<string | symbol, unknown> & WeakKey);
				});
			} else {
				context.addInitializer(function () {
					const receiver = this as Record<string | symbol, unknown> & WeakKey;
					// Checking the descriptor avoids invoking an overriding accessor while `super()` is still running.
					const descriptor = getPropertyDescriptor(Object.getPrototypeOf(receiver) as WeakKey, context.name);
					if (descriptor?.value !== decoratedMethod) {
						return;
					}

					installMethod(receiver, getMemoizedMethod(receiver));
				});
			}

			return decoratedMethod;
		}

		const memoizedGetters = new WeakMap<WeakKey, () => ReturnType<FunctionToMemoize>>();

		return function (this: unknown) {
			let memoizedGetter = memoizedGetters.get(this as WeakKey);
			if (!memoizedGetter) {
				memoizedGetter = memoize(() => target.call(this) as ReturnType<FunctionToMemoize>, options as Options<() => ReturnType<FunctionToMemoize>, CacheKeyType>);
				memoizedGetters.set(this as WeakKey, memoizedGetter);
			}

			return memoizedGetter();
		};
	}

	return decorator;
}

/**
Clear all cached data of a memoized function.

@param function_ - The memoized function.
*/
export function memoizeClear(function_: AnyFunction): void {
	const cache = cacheStore.get(function_);
	if (!cache) {
		throw new TypeError('Can\'t clear a function that was not memoized!');
	}

	if (typeof cache.clear !== 'function') {
		throw new TypeError('The cache Map can\'t be cleared!');
	}

	cache.clear();

	for (const timer of cacheTimerStore.get(function_) ?? []) {
		clearTimeout(timer);
	}

	cacheTimerStore.delete(function_);
}

/**
Check if a specific set of arguments is cached for a memoized function.

@param function_ - The memoized function.
@param arguments_ - The arguments to check.
@returns `true` if the arguments are cached and not expired, `false` otherwise.

Uses the same argument processing as the memoized function, including any custom `cacheKey` function.

@example
```
import memoize, {memoizeIsCached} from 'memoize';

const expensive = memoize((a, b) => a + b, {cacheKey: JSON.stringify});
expensive(1, 2);

memoizeIsCached(expensive, 1, 2);
//=> true

memoizeIsCached(expensive, 3, 4);
//=> false
```
*/
export function memoizeIsCached<FunctionToMemoize extends AnyFunction>(
	function_: FunctionToMemoize,
	...arguments_: Parameters<FunctionToMemoize>
): boolean {
	const cacheKey = cacheKeyStore.get(function_);
	if (!cacheKey) {
		return false;
	}

	const cache = cacheStore.get(function_)!;

	const key = cacheKey(arguments_);
	const item = getValidCacheItem(cache, key);
	return item !== undefined;
}

/**
Check whether a function is memoized.

@param function_ - The function to check.
@returns `true` if the function was returned by `memoize()`, `false` otherwise.

Note: `memoize()` returns the given function unchanged when the `maxAge` option is `0` or negative, as nothing is cached. Such a function is correctly reported as not memoized.

@example
```
import memoize, {isMemoized} from 'memoize';

const function_ = (text: string) => Boolean(text);

isMemoized(memoize(function_));
//=> true

isMemoized(function_);
//=> false
```
*/
export function isMemoized<FunctionToMemoize extends AnyFunction>(function_: FunctionToMemoize): function_ is Memoized<FunctionToMemoize> {
	return cacheStore.has(function_);
}
