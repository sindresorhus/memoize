import {expectType} from 'tsd';
import mem = require('.');

const fn = (string: string) => true;

expectType<typeof fn>(mem(fn));
expectType<typeof fn>(mem(fn, {maxAge: 1}));
expectType<typeof fn>(mem(fn, {cacheKey: (...arguments_) => arguments_}));
expectType<typeof fn>(
	mem(
		fn,
		{
			cacheKey: (arguments_) => arguments_[0],
			cache: new Map<string, {data: boolean; maxAge: number}>()
		}
	)
);
expectType<typeof fn>(
	mem(fn, {cache: new Map<string, {data: boolean; maxAge: number}>()})
);

// Testing that the full cache object works with type inference
const objFnReturnsNum = function({ key }: { key: string }) { return 10 }
expectType<typeof objFnReturnsNum>(
	mem(
		objFnReturnsNum,
		{
			cacheKey : function(args: [{ key: string }]) {
				return new Date();
			},
			cache : {
				get: function(key: Date) {
					return {
						data: 5,
						maxAge : 2
					}
				},
				set : function(key: Date, value: { data : number, maxAge : number }) {

				},
				has : function(key: Date) {
					return true;
				},
				delete : function(key: Date) {

				},
				clear : function() {}
			}
		}
	)
)

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
