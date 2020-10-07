import test, {ExecutionContext} from 'ava';
import mem from "../"

test('.decorator()', (t: ExecutionContext) => {
	class TestClass {
		constructor() {
			this.i = 0;
		}

		@mem.decorator()
		counter() {
			return ++this.i;
		}
	}

	const alpha = new TestClass();
	t.is(alpha.counter(), 1);
	t.is(alpha.counter(), 1, 'The method should be memoized');

	const beta = new TestClass();
	t.is(beta.counter(), 1, 'The method should not be memoized across instances');
});
