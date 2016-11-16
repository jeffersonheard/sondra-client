const chai = require('chai');
const { Sondra } = require('../src/sondra.js');

chai.should();

describe('Sondra', () => {
  describe('auth', () => {
    const pronto = new Sondra().suite('http', 'localhost', 5000);
    const auth = pronto.app('auth');
    const users = auth.collection('users');
    const login = auth.method('login');
    const jefferson = users.document('jefferson');

    it('returns the url for the auth app', () => {
      auth.get('url').should.equal('http://localhost:5000/api/auth;format=json');
    });

    it('returns the schema url for the auth app with indent set to 2', () => {
      auth.format('json', {indent: 2}).get('url').should.equal('http://localhost:5000/api/auth;format=json;indent=2');
    })

    it('returns the url for the users collection', () => {
      users.get('url').should.equal('http://localhost:5000/api/auth/users;format=json');
    });

    it('returns the url for the login method of auth', () => {
      login.get('url').should.equal('http://localhost:5000/api/auth.login;format=json');
    });

    it('returns the url for the user jefferson', () => {
      jefferson.get('url').should.equal('http://localhost:5000/api/auth/users/jefferson;format=json');
    });

    it('fetches a schema', () => {
      return users.format('json', {bare_keys: true}).fetchSchema().then((schema) => {  // we set the format first to make sure that schema overrides it.
        schema.type.should.equal('object');
      });
    });

    it('logs the user in and grabs a ticket', () => {
      return login.call({body: {username: 'jefferson', password: 'tanac32fark'}}).then((rsp) => {
        const { _:token } = rsp;
        token.should.be.a('string');

        const core = pronto.app('core').auth(token);

        core.get('url').should.equal('http://localhost:5000/api/core;format=json');

        const tickets = core.collection('tickets');

        return tickets.call().then((ts) => {
          ts.should.be.an('array');
          ts.should.be.not.empty;

          const ticketId = ts[0].id;
          return tickets.fetchDocument(ticketId).then((t) => {
            t.should.be.an('object');
            t.id.should.equal(ticketId);
          });
        });

      });
    });

  });


});
