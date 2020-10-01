import {expectType} from 'tsd';
import mem = require('.');

const fn = (string: string) => true;

expectType<typeof fn>(mem(fn));
expectType<typeof fn>(mem(fn, {maxAge: 1}));
expectType<typeof fn>(mem(fn, {cacheKey: (...arguments_) => arguments_}));
expectType<typeof fn>(
	mem(
		fn,
		{cacheKey: (arguments_) => arguments_,
		cache: new Map<[string], {data: boolean; maxAge: number}>()})
);
expectType<typeof fn>(
	mem(fn, {cache: new Map<[string], {data: boolean; maxAge: number}>()})
);


mem(fn, {
	cacheKey: (arguments_) => {
		expectType<[string]>(arguments_)
	}
});

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
