import {expectType} from 'tsd';
import mem = require('..');

const fn = (text: string) => Boolean(text);

expectType<typeof fn>(mem(fn));
expectType<typeof fn>(mem(fn, {maxAge: 1}));
expectType<typeof fn>(mem(fn, {cacheKey: ([firstArgument]: [string]) => firstArgument}));
expectType<typeof fn>(
	mem(fn, {
		// The cacheKey returns an array. This isn't deduplicated by a regular Map, but it's valid. The correct solution would be to use ManyKeysMap to deduplicate it correctly
		cacheKey: (arguments_: [string]) => arguments_,
		cache: new Map<[string], {data: boolean; maxAge: number}>()
	})
);
expectType<typeof fn>(
	// The `firstArgument` of `fn` is of type `string`, so it's used
	mem(fn, {cache: new Map<string, {data: boolean; maxAge: number}>()})
);

/* Overloaded function tests */
function overloadedFn(parameter: false): false;
function overloadedFn(parameter: true): true;
function overloadedFn(parameter: boolean): boolean {
	return parameter;
}

expectType<typeof overloadedFn>(mem(overloadedFn));
expectType<true>(mem(overloadedFn)(true));
expectType<false>(mem(overloadedFn)(false));

mem.clear(fn);

// `cacheKey` tests.
// The argument should match the memoized function’s parameters
mem((text: string) => Boolean(text), {
	cacheKey: arguments_ => {
		expectType<[string]>(arguments_);
	}
});

mem(() => 1, {
	cacheKey: arguments_ => {
		expectType<[]>(arguments_); // eslint-disable-line @typescript-eslint/ban-types
	}
});

// Ensures that the various cache functions infer their arguments type from the return type of `cacheKey`
mem((_arguments: {key: string}) => 1, {
	cacheKey: (arguments_: [{key: string}]) => {
		expectType<[{key: string}]>(arguments_);
		return new Date();
	},
	cache: {
		get: key => {
			expectType<Date>(key);

			return {
				data: 5,
				maxAge: 2
			};
		},
		set: (key, data) => {
			expectType<Date>(key);
			expectType<{data: number; maxAge: number}>(data);
		},
		has: key => {
			expectType<Date>(key);
			return true;
		},
		delete: key => {
			expectType<Date>(key);
		},
		clear: () => {
			return undefined;
		}
	}
});
