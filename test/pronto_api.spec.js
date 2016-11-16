const chai = require('chai');
const { Pronto365 } = require('../src/pronto_api.js');

chai.should();

const P = new Pronto365();
const p = P.suite('http', 'localhost', 5000);

describe('Pronto structure', function() {
  it('verifies P is actually an instance of Pronto365', function() {
    P.should.be.an('object');
    P.should.have.property('suite');
  });

  it('logs the user in and sets up the API structure', function() {
    return p.getApi()
      .then(pronto => {
        const api = pronto.get('api');
        api.should.have.property('core');
        api.should.have.property('auth');
        api.auth.cs.should.have.property('users');
        api.auth.should.have.property('title');
        api.auth.should.have.property('description');
        api.auth.should.have.property('ms');
        api.auth.ms.should.have.property('login');
        api.auth.cs.users.should.have.property('ms');
        api.core.cs.should.have.property('tickets');
        api.core.cs.tickets.should.have.property('ms');
        api.core.cs.tickets.ms.should.have.property('prefillForAsset');
        api.core.cs.should.have.property('ticketTypes');
      });
  });

  it('logs the user in and grabs a list of tickets', function() {
    return p.app('auth').method('login')
      .call({body: {username: 'jefferson', password: 'tanac32fark'}})
      .then((rsp) => p.getApi(rsp._))
      .then(pronto => pronto.get('api').core.cs.tickets.c.call())
      .then(ts => { ts.should.be.an('array'); })
  });

  it('logs the user in and calls a method', function() {
    return p.app('auth').method('login')
      .call({body: {username: 'nabcep_tracey', password: 'tanac32fark'}})
      .then((rsp) => p.getApi(rsp._))
      .then(pronto => pronto.get('api').core.cs.tickets.ms.currentTicketForProfessional.m.call())
      .then(t => { t.should.be.an('object') })
  });
});

// describe('Pronto Ticket Lifecycle', function() {
//   it('logs a professional in and grabs their tickets', function() {
//     let custPronto = null;
//     let profPronto = null;
//
//     const login = p.app('auth').method('login');
//     return Promise.all([
//       login.callWith({username: 'admin', password: 'tanac32fark'}).then(token => p.getApi(token._)),
//       login.callWith({username: 'nabcep_tracey', password: 'tanac32fark'}).then(token => p.getApi(token._)),
//       login.callWith({username: 'swarthmore_power', password: 'tanac32fark'}).then(token => p.getApi(token._))
//     ])
//     .then(([admin, professional, customer]) => {
//       custPronto = professional;
//       profPronto = customer;
//     })
//     .then(() => profPronto.get('api').core.cs.professionals.c.document('nabcep_tracey').call())
//     .then(nabcep_tracey => {
//       nabcep_tracey.assigned_tickets.should.be.an('array');
//       nabcep_tracey.assigned_tickets.should.have.length(0);
//     })
//     .then(() => Promise.all([
//       custPronto.get('api').core.cs.assets.c.call(),
//       custPronto.get('api').core.cs.ticketTypes.c.call()
//     ]))
//     .then(([assets, ticketTypes]) => {
//       const a = assets[0].id;
//       const tt = ticketTypes[0].id;
//       a.should.be.a('string');
//       tt.should.be.a('string');
//       return custPronto.get('api').core.cs.tickets.m.prefillForAsset(a, tt);
//     })
//     .then(fullTicket => {
//       fullTicket.should.include.keys(
//         'ticket', 'ticket_type', 'asset', 'asset_class', 'allowed_to_work',
//         'worksheets', 'work_requirements', 'response_forms'
//       );
//       fullTicket.allowed_to_work.should.equal(true);
//       return custPronto.get('api').core.cs.tckets.c.document(fullTicket.ticket.id).ms.accept.call();
//     })
//     .then(fullTicket => {
//       fullTicket.ticket.should.include.keys('assigned_professionals');
//       fullTicket.ticket.assigned_professionals.should.be.an('array');
//       fullTicket.ticket.assigned_professionals.should.have.length(1);
//       fullTicket.ticket.assigned_professionals[0].professionals.should.equal('nabcep_tracey');
//     })
//     .finally(() => {
//
//     })
//   });

//});
