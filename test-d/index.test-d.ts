import {expectType} from 'tsd';
import memoize, {memoizeClear} from '../index.js';

// eslint-disable-next-line unicorn/prefer-native-coercion-functions -- Required `string` type
const fn = (text: string) => Boolean(text);

expectType<typeof fn>(memoize(fn));
expectType<typeof fn>(memoize(fn, {maxAge: 1}));
expectType<typeof fn>(memoize(fn, {cacheKey: ([firstArgument]: [string]) => firstArgument}));
expectType<typeof fn>(
	memoize(fn, {
		// The cacheKey returns an array. This isn't deduplicated by a regular Map, but it's valid. The correct solution would be to use ManyKeysMap to deduplicate it correctly
		cacheKey: (arguments_: [string]) => arguments_,
		cache: new Map<[string], {data: boolean; maxAge: number}>(),
	}),
);
expectType<typeof fn>(
	// The `firstArgument` of `fn` is of type `string`, so it's used
	memoize(fn, {cache: new Map<string, {data: boolean; maxAge: number}>()}),
);

/* Overloaded function tests */
function overloadedFn(parameter: false): false;
function overloadedFn(parameter: true): true;
function overloadedFn(parameter: boolean): boolean {
	return parameter;
}

expectType<typeof overloadedFn>(memoize(overloadedFn));
expectType<true>(memoize(overloadedFn)(true));
expectType<false>(memoize(overloadedFn)(false));

memoizeClear(fn);

// `cacheKey` tests.
// The argument should match the memoized function’s parameters
// eslint-disable-next-line unicorn/prefer-native-coercion-functions -- Required `string` type
memoize((text: string) => Boolean(text), {
	cacheKey(arguments_) {
		expectType<[string]>(arguments_);
	},
});

memoize(() => 1, {
	cacheKey(arguments_) {
		expectType<[]>(arguments_); // eslint-disable-line @typescript-eslint/ban-types
	},
});

// Ensures that the various cache functions infer their arguments type from the return type of `cacheKey`
memoize((_arguments: {key: string}) => 1, {
	cacheKey(arguments_: [{key: string}]) {
		expectType<[{key: string}]>(arguments_);
		return new Date();
	},
	cache: {
		get(key) {
			expectType<Date>(key);

			return {
				data: 5,
				maxAge: 2,
			};
		},
		set(key, data) {
			expectType<Date>(key);
			expectType<{data: number; maxAge: number}>(data);
		},
		has(key) {
			expectType<Date>(key);
			return true;
		},
		delete(key) {
			expectType<Date>(key);
		},
		clear: () => undefined,
	},
});
