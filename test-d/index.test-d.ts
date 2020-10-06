import {expectType} from 'tsd';
import mem = require('..');

const fn = (text: string) => Boolean(text);

expectType<typeof fn>(mem(fn));
expectType<typeof fn>(mem(fn, {maxAge: 1}));
expectType<typeof fn>(mem(fn, {cacheKey: ([firstArgument]) => firstArgument}));
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
