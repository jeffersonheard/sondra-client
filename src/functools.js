import _ from 'lodash';

/**
 * Works like Clojure's thread-first. Takes a series of partials and applies them in order, starting
 * with initial and progressing to the end. It returns the result of the last partial applied.
 *
 * @param  {thunk or value} initial -  The initial
 * @param  {partials} ...partials - A list of functions of a single argument. They should always
 *                                  return a value, and the return value should always be accepted
 *                                  by the next function down the line.
 *
 * @return {value}          The return value of the last function in the list.
 */
export const thread = (initial, ...partials) =>
  _.reduce(partials, (v, x) => x(v), _.isFunction(initial) ? initial() : initial);
