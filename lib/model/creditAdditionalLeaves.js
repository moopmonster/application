
'use strict';

const
  _ = require('underscore'),
  moment = require('moment'),
  Promise= require('bluebird');

const creditAdditionalLeaves = ({company},RequestedUser,date_credit_leave,admin_remarks) => {

  const
    yearNow = moment.utc().year();
    let flow = Promise.resolve(company.getUsers());

    flow = flow.then(users => Promise.map(
    users,
    user => {
      return Promise.resolve(user.reload_with_leave_details({year:moment.utc(yearNow, 'YYYY')}))
        .then(user => user.promise_allowance({year:moment.utc(yearNow, 'YYYY')}))
        .then(allowance => {

          return user.promise_to_add_Annual_Leave({
            remarks: admin_remarks,
            date: date_credit_leave,
            employee: user,
            requested: RequestedUser
          });
        })
        .then(() => console.log(`Credit additional 1 leave day in ${date_credit_leave} for user ${user.id} with remarks of :${admin_remarks}`));
    },
    {concurrency : 1}
  ));

  return flow;
};

module.exports = {creditAdditionalLeaves};
