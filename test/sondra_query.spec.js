const chai = require('chai');
const { Sondra, QuerySet } = require('../src/sondra.js');

chai.should();

describe('Sondra queries', () => {
  const pronto = new Sondra().suite('http', 'localhost', 5000);
  const auth = pronto.app('auth');
  const login = auth.method('login');

  it('checks to make sure simple limit queries are formatted correctly', () => {
    const q = new QuerySet().start(0).limit(5);
    q.value().should.have.property('start');
    q.value().should.have.property('limit');
    q.value().start.should.equal(0);
    q.value().limit.should.equal(5);
  });

  it('starts the result set at 0 and limits the length to 5', () => {
    const start0Limit5 = new QuerySet().start(0).limit(5);
    const start1Limit5 = new QuerySet().start(1).limit(5);

    let result0, coll;

    return login.call({body: {username: 'jefferson', password: 'tanac32fark'}})
      .then((rsp) => {
        const { _:token } = rsp;
        token.should.be.a('string');  // sanity check;

        coll = pronto.auth(token).app('core').collection('certifications').format('json', {bare_keys: true}).requestMethod('GET');
        //coll.query(start0Limit5).get('url').should.equal('http://localhost:5000/api/core/certifications;format=json?start=0&limit=5');
        return coll.query(start0Limit5).call();
      })
      .then((rsp) => {
        rsp.should.have.length(5);
        result0 = rsp;
        return coll.query(start1Limit5).call();
      })
      .then((rsp) => {
        rsp.should.have.length(5);
        rsp[0].id.should.equal(result0[1].id); // make sure that order of results stays the same.
      })
  });
});
