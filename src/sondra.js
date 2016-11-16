/**
 * A module for making sane calls to Sondra-based webservices using fetch for regular HTTP and and
 * websockets.
 *
 * The basic principal here is immutability and context. Most methods of this object return new
 * contexts.  Under the hood this uses immutable.js, so it is quite efficient.
 *
 * @example
 * var suite = Sondra('www.365pronto.com', 5000);  // the application suite.
 * var auth = suite.app('auth');
 * var login = auth.method('login');
 *
 * var core = suite.app('core');  // the app
 *
 * login.call({body: {username: 'username', password: 'password'}})  // this is an actual remote method call that returns a promise.
 *  .then((rsp) => {
 *    core = core.addHeader({Authorization: `Bearer ${rsp.token}`});  // all new contexts generated from core will include this header.
 *  }).catch((err) => {...});
 */
const URLSearchParams = require('url-search-params');
import Immutable, { Record, OrderedMap, List, Map } from 'immutable';
import _ from 'lodash';
import Promise from 'bluebird';
import { thread } from './functools.js';

const DefaultFormattingOptions = List([{format: 'json'}]);

const responseFormat = (fmt = DefaultFormattingOptions.toJS()) => thread(
  fmt, // initial value.
  _.partial(_.map, _, (v, k) => `${_.escape(k)}=${_.escape(v)}`)).join(';');

const _logTemporaryError = (...args) => { console.error(args); }
let nextDeferredRequestId = 1;

const REFETCH_MILLISEC = 1500;
const DEFAULT_MAX_TRIES = 10;

const initialQuery = OrderedMap({});

/**
 * A QuerySet object to be used to limit the documents retrieved from a Sondra collection.
 *
 * The queryset only applies when application and collection are set and document and method are
 * not.  The QuerySet is an Immutable object.  Every method call returns a new QuerySet object with
 * the new query applied to the existing query. In this way you can 'build up' queries or save them
 * for later.
 *
 * Methods referred to as "Filter" methods stack in the order they are applied to the object.
 */
export class QuerySet {
  constructor(q = initialQuery) {
    if(_.isString(q)) {
      this.q = Immutable.fromJS(JSON.parse(q));
    } else if(_.isPlainObject(q)) {
      this.q = Immutable.fromJS(q);
    } else {
      this.q = q;
    }
  }

  toJSON() {
    return this.q.toJS();
  }

  /**
   * Limit the results to specific documents in the collection.
   *
   * @type {[type]}
   */
  forKeys(keys, index=null) {
    let q1 = this.q.set('keys', List(keys));
    if(index) {
      q1 = q1.set('index', index);
    }

    return new QuerySet(q1);
  }

  /**
   * Limit the results to a
   * @type {[type]}
   */
  lt(lhs, rhs, dflt=false) {
    let q1 = this.q;
    let flt = this.q.has('flt') ? this.q.get('flt') : List();
    const op = Map({op: '<', lhs, rhs, "default": dflt});
    flt = flt.push(op);
    q1 = q1.set('flt', flt);

    return new QuerySet(q1);
  }

  gt(lhs, rhs, dflt=false) {
    let q1 = this.q;
    let flt = this.q.has('flt') ? this.q.get('flt') : List();
    const op = Map({op: '>', lhs, rhs, "default": dflt});
    flt = flt.push(op);
    q1 = q1.set('flt', flt);

    return new QuerySet(q1);
  }

  lte(lhs, rhs, dflt=false) {
    let q1 = this.q;
    let flt = this.q.has('flt') ? this.q.get('flt') : List();
    const op = Map({op: '<=', lhs, rhs, "default": dflt});
    flt = flt.push(op);
    q1 = q1.set('flt', flt);

    return new QuerySet(q1);
  }

  gte(lhs, rhs, dflt=false) {
    let q1 = this.q;
    let flt = this.q.has('flt') ? this.q.get('flt') : List();
    const op = Map({op: '>=', lhs, rhs, "default": dflt});
    flt = flt.push(op);
    q1 = q1.set('flt', flt);

    return new QuerySet(q1);
  }

  eq(lhs, rhs, dflt=false) {
    let q1 = this.q;
    let flt = this.q.has('flt') ? this.q.get('flt') : List();
    const op = Map({op: '==', lhs, rhs, "default": dflt});
    flt = flt.push(op);
    q1 = q1.set('flt', flt);

    return new QuerySet(q1);
  }

  match(lhs, rhs, dflt=false) {
    let q1 = this.q;
    let flt = this.q.has('flt') ? this.q.get('flt') : List();
    const op = Map({op: 'match', lhs, rhs, "default": dflt});
    flt = flt.push(op);
    q1 = q1.set('flt', flt);

    return new QuerySet(q1);
  }

  contains(lhs, rhs, dflt=false) {
    let q1 = this.q;
    let flt = this.q.has('flt') ? this.q.get('flt') : List();
    const op = Map({op: 'contains', lhs, rhs, "default": dflt});
    flt = flt.push(op);
    q1 = q1.set('flt', flt);

    return new QuerySet(q1);
  }

  hasFields(fields) {
    let q1 = this.q;
    let flt = this.q.has('flt') ? this.q.get('flt') : List();
    const op = Map({op: 'has_fields', fields});
    flt = flt.push(op);
    q1 = q1.set('flt', flt);

    return new QuerySet(q1);
  }

  getIntersecting(geometry, against=null) {
    let op = Immutable.fromJS({'op': 'get_intersecting', args: [geometry]});
    if(against) {
      op = op.set('against', against);
    }
    return new QuerySet(this.q.set('geo', op));
  }

  getNearest(point, against=null, max_results=100, max_dist=100000, unit='m') {
    let op = Immutable.fromJS({'op': 'get_nearest', args: [point], kwargs: {max_results, max_dist, unit}});
    if(against) {
      op = op.set('against', against);
    }
    return new QuerySet(this.q.set('geo', op));
  }

  start(x) {
    return new QuerySet(this.q.set('start', x));
  }

  end(x) {
    return new QuerySet(this.q.set('end', x));
  }

  limit(x) {
    return new QuerySet(this.q.set('limit', x));
  }

  count() {
    return new QuerySet(this.q.set('agg', Map({op: 'count'})));
  }

  countValue(value) {
    return new QuerySet(this.q.set('agg', Map({op: 'count', args: [value]})));
  }

  sum(field) {
    return new QuerySet(this.q.set('agg', Map({op: 'sum', args: [field]})));
  }

  avg(field) {
    return new QuerySet(this.q.set('agg', Map({op: 'avg', args: [field]})));
  }

  min(field) {
    return new QuerySet(this.q.set('agg', Map({op: 'min', args: [field]})));
  }

  max(field) {
    return new QuerySet(this.q.set('agg', Map({op: 'max', args: [field]})));
  }

  pluck(...fields) {
    return new QuerySet(this.q.set('agg', Map({op: 'pluck', args: fields})));
  }

  without(...fields) {
    return new QuerySet(this.q.set('agg', Map({op: 'without', args: fields})));
  }

  distinct(index=null) {
    if(index) {
      return new QuerySet(this.q.set('agg', Map({op: 'distinct', kwargs: {index}})));
    } else {
      return new QuerySet(this.q.set('agg', Map({op: 'distinct'})));
    }
  }

  minInIndex(index) {
    return new QuerySet(this.q.set('agg', Map({op: 'min', kwargs: {index}})));
  }

  maxInIndex(index) {
    return new QuerySet(this.q.set('agg', Map({op: 'max', kwargs: {index}})));
  }

  value(cook = true) {
    if(cook) {
      let ret = {};
      const jsonProps = ['flt', 'agg', 'geo', 'keys'];
      const bareProps = ['index', 'start', 'limit', 'end'];
      _.forEach(jsonProps, (p) => {
        if(this.q.has(p)) {
          ret[p] = JSON.stringify(this.q.get(p).toJS());
        }
      });

      _.forEach(bareProps, (p) => {
        if(this.q.has(p)) {
          ret[p] = this.q.get(p);
        }
      });

      return ret;
    } else {
      return this.q.toJS();
    }
  }
}


const DefaultBasePath = List(['api']);
const DefaultContext = Record({
  protocol: 'https',
  host: 'localhost',
  port: '443',
  mode: 'cors',
  compress: true,
  url: '',
  basePath: DefaultBasePath,
  headers: OrderedMap(),
  additionalRequestOptions: OrderedMap({}),
  requestMethod: 'GET',
  suite: null,
  app: null,
  collection: null,
  document: null,
  method: null,
  params: OrderedMap({format: 'json'}),
  body: OrderedMap({}),
  querySet: new QuerySet(),
  api: {},
  robust: Map({
    maxTries: DEFAULT_MAX_TRIES,
    refetchDelay: REFETCH_MILLISEC,
    pingPath: '/ping'
  })
});

export class Sondra extends DefaultContext {
  suite(protocol='https', host='localhost', port=443, basePath=DefaultBasePath) {
    const s = this.merge({
      protocol, host, port
    });

    return s.set('url', s.calculateUrl());
  }

  calculateUrl() {
    const { protocol, host, port, params, app, collection, document, method, basePath } = this.toJS();
    const openingPath = basePath.join('/');
    let url = `${protocol}://${host}:${port}/${openingPath}`;
    if(app) {
      url += `/${app}`;
    }
    if(collection) {
      url += `/${collection}`;
    }
    if(document) {
      url += `/${document}`;
    }
    if(method) {
      url += `.${method}`;
    }
    url += ';' + responseFormat(params);
    return this.set('url', url);
  }

  _isOnline() {
    const NoConnection = _.has(window, 'Connection') ? Connection.NONE : false;
    const host = this.get('host');
    const protocol = this.get('protocol');
    const port = this.get('port');
    const pingPath = this.getIn(['robust', 'pingPath']);
    const ping = `${protocol}://${host}:${port}${pingPath}`;

    if(!_.has(navigator, 'connection.type')) {
      return fetch(ping, {method: 'HEAD'});
    } else if(navigator.connection.type !== NoConnection) {
      return fetch(ping, {method: 'HEAD'});
    } else {
      return new Promise(function(resolve, reject) {
        reject("not online");
      });
    }
  }

  app(name) {
    return this.merge({
      app: name,
      collection: null,
      document: null,
      method: null,
      body: OrderedMap({}),
    }).calculateUrl();
  }

  collection(name) {
    return this.merge({
      collection: name,
      document: null,
      method: null,
      body: OrderedMap({}),
    }).calculateUrl();
  }

  document(pk) {
    return this.merge({
      document: pk,
      method: null,
      body: OrderedMap({}),
    }).calculateUrl();
  }

  method(name) {
    return this.merge({
      requestMethod: 'POST',
      method: name,
      body: OrderedMap({}),
    }).calculateUrl();
  }

  auth(token) {
    return this.setIn(['headers', 'Authorization'], `Bearer ${token}`);
  }

  format(name='json', options={}) {
    return this.setIn(['params', 'format'], name).mergeIn(['params'], options).calculateUrl();
  }

  requestMethod(m) {
    return this.set('requestMethod', m);
  }

  query(querySet=null) {
    if(querySet === null) {
      return this.get('querySet');
    } else {
      return this.set('querySet', querySet);
    }
  }

  call(transientContext={}) {
    const { url, headers, requestMethod, mode, compress, additionalRequestOptions, body, querySet } = this.merge(transientContext).toObject();

    let requestHeaders = new Headers();
    _.forEach(headers, (value, name) => { requestHeaders.append(name, value); });

    let requestUrl = url;
    let requestOptions;
    if(requestMethod !== 'GET') {
      const queryBody = _.extend({}, body.toJS(), querySet.value());
      const requestBody = _.size(queryBody) === 0 ? null : JSON.stringify(queryBody);
      requestOptions = additionalRequestOptions.merge({ method: requestMethod, body: requestBody, mode, compress, headers }).toJS();
    } else {
      const queryBody = _.extend({}, body.toJS(), querySet.value(false));
      const requestBody = _.reduce(queryBody, (a, v, k) => { a.append(k, v); return a; }, new URLSearchParams());
      requestUrl = requestUrl + "?" + requestBody.toString();  // not all browsers support adding URLSearchParams as the body of a GET request.
      requestOptions = additionalRequestOptions.merge({ method: requestMethod, mode, compress, headers }).toJS();
    }

    return fetch(requestUrl, requestOptions).then((rsp) => {
      if(rsp.ok) {
        return rsp.json();
      } else {
        return rsp.json().then((err) => Promise.reject([rsp.status, err]));
      }
    }).catch((err) => Promise.reject([0, err]));
  }

  callWith(body = null) {
    if(body) {
      return this.call({body: body});
    } else {
      return this.call();
    }
  }

  fetchDocument(key, transientContext={}) {
    return this.document(key).call(transientContext);
  }

  deleteDocument(key) {
    return this.document(key).call({requestMethod: "DELETE"});
  }

  patchDocument(key, values) {
    return this.document(key).call({requestMethod: "PATCH", body: values});
  }

  replaceDocument(key, replacement) {
    return this.document(key).call({requestMethod: "PUT", body: replacement});
  }

  createDocument(key, doc) {
    return this.document(key).call({requestMethod: "POST", body: doc});
  }

  fetchSchema(schemaOptions={}) {
    return this.set('params', _.assign({}, schemaOptions, {format: 'schema'})).calculateUrl().call();
  }

  /**
   * A proxied Fetch that retries a request up to N times because of network errors.
   *
   * @param  {object} transientContext - Optional. A context to apply to this API object before calling the server, same as in <pre>.call(...)</pre>.
   * @param  {action(string, data)} successCallback - Optional. A function to call when the call succeeds.  Called as the argument to Promise.resolve.
   * @param  {function(string, string, object)} temporaryErrorCallback - Optional. A function to call when the call fails temporarily.  By default it simply logs to the console.
   * @param  {string} [actionOnFail='defer'] - 'defer', 'fail', 'ignore' How to handle the request if it fails.  Requests that fail due to a network error will defer if requested.
   *
   * @example
   * // Send a bit of data and get a response
   * this.robustCall()
   *   .then(({deferredRequestId, data}) => { ... do something with the data ... })  // this could take awhile, but the program should continue;
   *   .catch(({deferredRequestId, url, status, error}))  // this could also take awhile, but the program should continue.
   *
   * @returns {Promise} - A promise that is either a deferred action or a response.  Resolved promises receive an object <pre>{deferredRequestId, data}</pre>. Rejected promises receive
   */
  robustCall(transientContext={}, temporaryErrorCallback = _logTemporaryError, actionOnFail = "defer", _n=0, _rqid=null) {
    const { url, headers, requestMethod, mode, compress, additionalRequestOptions, body, robust } = this.merge(transientContext).toObject();

    // construct the request headers and body
    let requestHeaders = new Headers();
    _.forEach(headers, (value, name) => { requestHeaders.append(name, value); });

    const deferredRequestId = _rqid || nextDeferredRequestId++;

    let requestUrl = url;
    let requestOptions;
    if(requestMethod !== 'GET') {
      const requestBody = _.size(body) === 0 ? null : JSON.stringify(body);
      requestOptions = additionalRequestOptions.merge({ method: requestMethod, body: requestBody, mode, compress, headers }).toJS();
    } else {
      const requestBody = _.reduce((body || Map()).toJS(), (a, v, k) => { a.append(k, v); return a; }, new URLSearchParams());
      requestUrl = requestUrl + "?" + requestBody.toString();  // not all browsers support adding URLSearchParams as the body of a GET request.
      requestOptions = additionalRequestOptions.merge({ method: requestMethod, mode, compress, headers }).toJS();
    }

    // Check to make sure that we have network (when possible) and that the server responds to a ping call.
    const p = new Promise((resolve, reject) => {

      // catch and then are backwards here because we want to catch the network error, but not any failures that happen in the .then() clause
      return this._isOnline().catch((error) => { // The network or server was not online.  We delay, but we do not increase the counter.
        const refetchDelay = this.getIn(['robust', 'refetchDelay']);
        return Promise.delay(refetchDelay, temporaryErrorCallback(deferredRequestId, url, error)).then(() =>
          this.robustCall(transientContext, temporaryErrorCallback, actionOnFail, _n, deferredRequestId));
      }).then(() => { // I f we have connectivity, make the fetch
        return fetch(url, requestOptions).then((rsp) => {
          if(rsp.ok) { // the request succeeded
            return rsp.json().then((data) => resolve({deferredRequestId, data}));
          } else { // an application error occurred. This is not due to network failure and will reject immediately.
            const status = rsp.status;
            return rsp.json().then((data) => reject({deferredRequestId, url, status, error:data}));
          }
        }).catch((error) => {
          const status = error.status || 0;
          if(status > 0) { // Then this is not due to a network failure. It will reject immediately.  This should catch 500s, 400s.
            return Promise.reject({deferredRequestId, url, status:error.status, error});
          } else switch(actionOnFail) { // a network error occurred. these will be retried if the actionOnFail was "defer" and we haven't yet tried the max number of times.
            case 'defer': // delay the call for a few seconds and try again.
              const { maxTries, refetchDelay } = robust.toJS();
              return Promise.delay(refetchDelay, temporaryErrorCallback(deferredRequestId, url, error)).then(() =>
                this.robustCall(transientContext, temporaryErrorCallback, _n < maxTries ? "defer" : "fail", _n+1));
            case 'fail': // reject the call entirely.
              return reject({deferredRequestId, url, status, error});
            case 'ignore': // ignore a failure (unusual).
              return resolve(null);
            default:
              throw new Error("Action on fail must be 'defer', 'ignore', or 'fail'");
          }
        });
      });

    });

    return p;
  }
}
