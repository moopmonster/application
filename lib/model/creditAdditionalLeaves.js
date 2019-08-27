
'use strict';

const
  _ = require('underscore'),
  moment = require('moment'),
  Promise= require('bluebird');

const creditAdditionalLeaves = ({company},days_credit_additional_leave) => {

  console.log(company.getUsers());
  console.log(days_credit_additional_leave);

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
            daysToAdd: days_credit_additional_leave,
            year: yearNow,
            employee: user,
          });
        })
        .then(() => console.log(`Credit additional ${days_credit_additional_leave} leave day(s) in ${yearNow} for user ${user.id}`));
    },
    {concurrency : 1}
  ));

  return flow;
};

module.exports = {creditAdditionalLeaves};
