import {expectType} from 'tsd';
import mem = require('.');

const fn = (string: string) => true;

expectType<(string: string) => boolean>(mem(fn));
expectType<(string: string) => boolean>(mem(fn, {maxAge: 1}));
expectType<(string: string) => boolean>(mem(fn, {cacheKey: (...arguments_) => arguments_}));
expectType<(string: string) => boolean>(
	mem(
		fn,
		{cacheKey: (arguments_) => arguments_,
		cache: new Map<[string], {data: boolean; maxAge: number}>()})
);
expectType<(string: string) => boolean>(
	mem(fn, {cache: new Map<[string], {data: boolean; maxAge: number}>()})
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
