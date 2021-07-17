import mimicFn from 'mimic-fn';
import mapAgeCleaner from 'map-age-cleaner';

type AnyFunction = (...arguments_: any) => any;

const cacheStore = new WeakMap<AnyFunction, CacheStorage<any, any>>();

interface CacheStorageContent<ValueType> {
	data: ValueType;
	maxAge: number;
}

interface CacheStorage<KeyType, ValueType> {
	has: (key: KeyType) => boolean;
	get: (key: KeyType) => CacheStorageContent<ValueType> | undefined;
	set: (key: KeyType, value: CacheStorageContent<ValueType>) => void;
	delete: (key: KeyType) => void;
	clear?: () => void;
}

interface Options<
	FunctionToMemoize extends AnyFunction,
	CacheKeyType,
> {
	/**
	Milliseconds until the cache expires.

	@default Infinity
	*/
	readonly maxAge?: number;

	/**
	Determines the cache key for storing the result based on the function arguments. By default, __only the first argument is considered__ and it only works with [primitives](https://developer.mozilla.org/en-US/docs/Glossary/Primitive).

	A `cacheKey` function can return any type supported by `Map` (or whatever structure you use in the `cache` option).

	You can have it cache **all** the arguments by value with `JSON.stringify`, if they are compatible:

	```
	import mem from 'mem';

	mem(function_, {cacheKey: JSON.stringify});
	```

	Or you can use a more full-featured serializer like [serialize-javascript](https://github.com/yahoo/serialize-javascript) to add support for `RegExp`, `Date` and so on.

	```
	import mem from 'mem';
	import serializeJavascript from 'serialize-javascript';

	mem(function_, {cacheKey: serializeJavascript});
	```

	@default arguments_ => arguments_[0]
	@example arguments_ => JSON.stringify(arguments_)
	*/
	readonly cacheKey?: (arguments_: Parameters<FunctionToMemoize>) => CacheKeyType;

	/**
	Use a different cache storage. Must implement the following methods: `.has(key)`, `.get(key)`, `.set(key, value)`, `.delete(key)`, and optionally `.clear()`. You could for example use a `WeakMap` instead or [`quick-lru`](https://github.com/sindresorhus/quick-lru) for a LRU cache.

	@default new Map()
	@example new WeakMap()
	*/
	readonly cache?: CacheStorage<CacheKeyType, ReturnType<FunctionToMemoize>>;
}

/**
[Memoize](https://en.wikipedia.org/wiki/Memoization) functions - An optimization used to speed up consecutive function calls by caching the result of calls with identical input.

@param fn - Function to be memoized.

@example
```
import mem from 'mem';

let index = 0;
const counter = () => ++index;
const memoized = mem(counter);

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
export default function mem<
	FunctionToMemoize extends AnyFunction,
	CacheKeyType,
>(
	fn: FunctionToMemoize,
	{
		cacheKey,
		cache = new Map(),
		maxAge,
	}: Options<FunctionToMemoize, CacheKeyType> = {},
): FunctionToMemoize {
	if (typeof maxAge === 'number') {
		mapAgeCleaner(cache as unknown as Map<CacheKeyType, ReturnType<FunctionToMemoize>>);
	}

	const memoized = function (this: any, ...arguments_: Parameters<FunctionToMemoize>): ReturnType<FunctionToMemoize> {
		const key = cacheKey ? cacheKey(arguments_) : arguments_[0] as CacheKeyType;

		const cacheItem = cache.get(key);
		if (cacheItem) {
			return cacheItem.data; // eslint-disable-line @typescript-eslint/no-unsafe-return
		}

		const result = fn.apply(this, arguments_) as ReturnType<FunctionToMemoize>;

		cache.set(key, {
			data: result,
			maxAge: maxAge ? Date.now() + maxAge : Number.POSITIVE_INFINITY,
		});

		return result; // eslint-disable-line @typescript-eslint/no-unsafe-return
	} as FunctionToMemoize;

	mimicFn(memoized, fn, {
		ignoreNonConfigurable: true,
	});

	cacheStore.set(memoized, cache);

	return memoized;
}

/**
@returns A [decorator](https://github.com/tc39/proposal-decorators) to memoize class methods or static class methods.

@example
```
import {memDecorator} from 'mem';

class Example {
	index = 0

	@memDecorator()
	counter() {
		return ++this.index;
	}
}

class ExampleWithOptions {
	index = 0

	@memDecorator({maxAge: 1000})
	counter() {
		return ++this.index;
	}
}
```
*/
export function memDecorator<
	FunctionToMemoize extends AnyFunction,
	CacheKeyType,
>(
	options: Options<FunctionToMemoize, CacheKeyType> = {},
) {
	const instanceMap = new WeakMap();

	return (
		target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor,
	): void => {
		const input = target[propertyKey]; // eslint-disable-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access

		if (typeof input !== 'function') {
			throw new TypeError('The decorated value must be a function');
		}

		delete descriptor.value;
		delete descriptor.writable;

		descriptor.get = function () {
			if (!instanceMap.has(this)) {
				const value = mem(input, options) as FunctionToMemoize;
				instanceMap.set(this, value);
				return value;
			}

			return instanceMap.get(this) as FunctionToMemoize;
		};
	};
}

/**
Clear all cached data of a memoized function.

@param fn - Memoized function.
*/
export function memClear(fn: AnyFunction): void {
	const cache = cacheStore.get(fn);
	if (!cache) {
		throw new TypeError('Can\'t clear a function that was not memoized!');
	}

	if (typeof cache.clear !== 'function') {
		throw new TypeError('The cache Map can\'t be cleared!');
	}

	cache.clear();
}
