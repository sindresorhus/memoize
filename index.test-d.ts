import {expectType} from 'tsd';
// Following import syntax makes sure that type intellisense interop with plain JS isn't broken
import mem = require('.');

const fn = (string: string) => true;

expectType<(string: string) => boolean>(mem(fn));
expectType<(string: string) => boolean>(mem(fn, {maxAge: 1}));
expectType<(string: string) => boolean>(mem(fn, {cacheKey: (...arguments_) => arguments_}));
expectType<(string: string) => boolean>(
	mem(
		fn,
		{cacheKey: (...arguments_) => arguments_,
		cache: new Map<[string], {data: boolean; maxAge: number}>()})
);
expectType<(string: string) => boolean>(
	mem(fn, {cache: new Map<[string], {data: boolean; maxAge: number}>()})
);
expectType<(string: string) => boolean>(mem(fn, {cachePromiseRejection: true}));

mem.clear(fn);
