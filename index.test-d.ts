import {expectType} from 'tsd-check';
import mem from '.';

const fn = (string: string) => true;

expectType<(string: string) => boolean>(mem(fn));
expectType<(string: string) => boolean>(mem(fn, {maxAge: 1}));
expectType<(string: string) => boolean>(mem(fn, {cacheKey: (...args) => args}));
expectType<(string: string) => boolean>(
	mem(fn, {cacheKey: (...args) => args, cache: new Map<[string], boolean>()})
);
expectType<(string: string) => boolean>(
	mem(fn, {cache: new Map<[string], boolean>()})
);
expectType<(string: string) => boolean>(mem(fn, {cachePromiseRejection: true}));

mem.clear(fn);
