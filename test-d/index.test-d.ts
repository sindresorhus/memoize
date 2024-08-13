import {expectType} from 'tsd';
import memoize, {memoizeClear} from '../index.js';

// eslint-disable-next-line unicorn/prefer-native-coercion-functions -- Required `string` type
const function_ = (text: string) => Boolean(text);

expectType<typeof function_>(memoize(function_));
expectType<typeof function_>(memoize(function_, {maxAge: 1}));
expectType<typeof function_>(memoize(function_, {cacheKey: ([firstArgument]: [string]) => firstArgument}));
expectType<typeof function_>(
	memoize(function_, {
		// The cacheKey returns an array. This isn't deduplicated by a regular Map, but it's valid. The correct solution would be to use ManyKeysMap to deduplicate it correctly
		cacheKey: (arguments_: [string]) => arguments_,
		cache: new Map<[string], {data: boolean; maxAge: number}>(),
	}),
);
expectType<typeof function_>(
	// The `firstArgument` of `fn` is of type `string`, so it's used
	memoize(function_, {cache: new Map<string, {data: boolean; maxAge: number}>()}),
);

/* Overloaded function tests */
function overloadedFunction(parameter: false): false;
function overloadedFunction(parameter: true): true;
function overloadedFunction(parameter: boolean): boolean {
	return parameter;
}

expectType<typeof overloadedFunction>(memoize(overloadedFunction));
expectType<true>(memoize(overloadedFunction)(true));
expectType<false>(memoize(overloadedFunction)(false));

memoizeClear(function_);

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
