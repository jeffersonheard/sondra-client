const chai = require('chai');
const _ = require('lodash');
const { Sondra } = require('../src/sondra.js');

chai.should();

describe('Sondra Robust Calls', function() {
  const pronto = new Sondra().suite('http', 'localhost', 5000);
  const auth = pronto.app('auth');
  const login = auth.method('login');

  it('Fetches the schema from the server', function() {
    return auth.format('schema').robustCall().then(({deferredRequestId, data}) => {
      data.should.be.an('object');
      data.type.should.equal('object');
    });
  })

  it('logs the user in and grabs a ticket', function() {
    return login.robustCall({body: {username: 'jefferson', password: 'tanac32fark'}}).then(({deferredRequestId, data}) => {
      const { _:token } = data;
      token.should.be.a('string');
    });
  });

  function failIfTemporaryError() {
    assert.fail('temporary error on bad login', 'permanent error');
  }
  it('fails to log the user in', function() {
    return login.robustCall({body: {username: 'jefferson', password: 'bad_password'}}, failIfTemporaryError).then(({deferredRequestId, data}) => {
      assert.fail('bad login succeeded', 'permanent error');
    }).catch((err) => {
      err.status.should.equal(403);
    });
  });

  function failIfTemporaryError() {
    assert.fail('temporary error on bad login', 'permanent error');
  }
  it('creates an internal server error', function() {
    return login.robustCall({body: {username: 'jefferson'}}, failIfTemporaryError).then(({deferredRequestId, data}) => {
      assert.fail('bad login succeeded', 'permanent error');
    }).catch((err) => {
      err.status.should.equal(500);
    });
  });
});

describe("Sondra Robust Calls in a Buggy Network", function() {
  const pronto = new Sondra().suite('http', 'localhost', 5000);
  const auth = pronto.app('auth');
  const login = auth.method('login');

  it('temporarily fails due to a network error, then succeeds', function(done) {
    this.timeout(8000);
    _.set(navigator, 'connection.type', false);
    setTimeout(() => { _.set(navigator, 'connection.type', true)}, 2500);
    login.robustCall({body: {username: 'jefferson', password: 'tanac32fark'}}).then(({deferredRequestId, data}) => {
      const { _:token } = data;
      token.should.be.a('string');
      done();
    });
  });

});
