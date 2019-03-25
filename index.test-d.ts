import {expectType} from 'tsd';
import mem = require('.');

const fn = (string: string) => true;

expectType<(string: string) => boolean>(mem(fn));
expectType<(string: string) => boolean>(mem(fn, {maxAge: 1}));
expectType<(string: string) => boolean>(mem(fn, {cacheKey: (...arguments_) => arguments_}));
expectType<(string: string) => boolean>(
	mem(fn, {cacheKey: (...arguments_) => arguments_, cache: new Map<[string], boolean>()})
);
expectType<(string: string) => boolean>(
	mem(fn, {cache: new Map<[string], boolean>()})
);
expectType<(string: string) => boolean>(mem(fn, {cachePromiseRejection: true}));

mem.clear(fn);
