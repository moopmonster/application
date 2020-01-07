
"use strict";

const
  Joi       = require('joi'),
  uuid      = require('node-uuid'),
  Promise   = require('bluebird'),
  _         = require('underscore'),
  Exception = require('../error'),
  Models    = require('./db');

const add_user_interface_schema = Joi.object().required().keys({
    email         : Joi.string().email(),
    lastname      : Joi.string(),
    name          : Joi.string(),
    nickname      : Joi.string(),
    company_id    : Joi.number().integer().positive(),
    department_id : Joi.number().integer().positive(),

    start_date   : Joi.string().optional(),
    end_date     : Joi.string().default(null).allow(null),
    admin        : Joi.boolean().default(false),
    isManager    : Joi.boolean().default(false),
    auto_approve : Joi.boolean().default(false),
    password     : Joi.string().default(() => uuid.v4(), 'Populate default password'),

    user_leave  : Joi.number(),
    user_cf     : Joi.number(),
  });


function add_user(args) {
  let validated_args = Joi.validate(args, add_user_interface_schema);

  if (validated_args.error) {
    console.log('An error occured when validatin parameters for add_user: ');
    console.dir(validated_args);
    Exception.throw_user_error({
      system_error : 'Failed to add new due to validation errors',
      user_error : 'Failed to add user',
    });
  }

  // Use validated (and expanded) arguments object
  args = validated_args.value;

  let attributes = {};

  attributes.email        = args.email.toLowerCase();
  attributes.lastname     = args.lastname;
  attributes.name         = args.name;
  attributes.nickname         = args.nickname;
  attributes.companyId    = args.company_id;
  attributes.DepartmentId = args.department_id;

  attributes.password     = Models.User.hashify_password(args.password);
  attributes.admin        = args.admin;
  attributes.isManager    = args.isManager;
  attribute.superadmin    = args.superadmin;
  attributes.auto_approve = args.auto_approve;
  attributes.end_date     = args.end_date;

  attributes.user_leave   = args.user_leave;
  attributes.user_cf      = args.user_cf;

  // Pass start date inky if it is set, otherwise rely on database to use
  // default value
  if (args.start_date) {
    attributes.start_date = args.start_date;
  }

  return Promise.resolve()

    // Ensure given department ID is owned by given company ID
    .then(() => Models.Department
      .findOne({
        where : { id : args.department_id, companyId : args.company_id },
      })
      .then( department => {
        if ( ! department ) {
          Exception.throw_user_error({
            system_error : 'Mismatch in department/company IDs when creating new user '
              + args.department_id + '/' + args.company_id,
            user_error : 'Used wrong department',
          });
        }
        return Promise.resolve();
      })
    )

    // Ensure provided email is free to use
    .then(() => validate_email_to_be_free({ email : args.email }))

    // Create new user record
    .then(() => Models.User.create(attributes));
}

function add_users_in_bulk(args) {
  let bulk_header = args.bulk_header,
      bulk_data   = args.bulk_data,
      company_id  = args.to_company_id;

  let company,
    email_vector_index      = 0,
    lastname_vector_index   = 1,
    name_vector_index       = 2,
    nickname_vector_index   = 3,
    department_vector_index = 4,
    start_date_vector_index = 5,
    leave_vector_index      = 6,
    cf_vector_index         = 7,
    mc_vector_index         = 8;

  return Models.Company.scope('with_simple_departments').findOne({
    where : { id : company_id },
  })


  // Validate department names and replace names with IDs
  .then(cmp => {
    company = cmp;
    let dep_name_to_id = _.object(
      company.departments.map(dep => [dep.name, dep.id])
    );

    let with_invalid_departments = _.filter(
      bulk_data, vector => ! dep_name_to_id[ vector[ department_vector_index] ]
    );

    if (with_invalid_departments.length > 0) {
      let unknown_departments =  with_invalid_departments
        .map(vector => '"'+vector[department_vector_index]+'"')
        .join(', ');

      Exception.throw_user_error({
        user_error : 'Following departments could not be found in '
          + company.name + ' account: ' + unknown_departments,
        system_error : 'While importing users to company '
          + company.id + ' there were unknown departments '
          + unknown_departments,
      });
    }

    bulk_data.forEach(
      vector => vector[ department_vector_index ] = dep_name_to_id[ vector[ department_vector_index ] ]
    );

    return Promise.resolve();
  })

  // Add users
  .then(() => {
    return Promise.map(bulk_data, vector => {
      let email = vector[ email_vector_index ];

      return Promise.resolve()
        .then(() => add_user({
          email         : email,
          lastname      : vector[ lastname_vector_index ],
          name          : vector[ name_vector_index ],
          nickname      : vector[ nickname_vector_index ],
          department_id : vector[ department_vector_index ],
          company_id    : company_id,
          start_date    : company.normalise_date(vector[ start_date_vector_index ]),

          user_leave    : vector[ leave_vector_index ],
          user_cf       : vector[ cf_vector_index ],
        }))
        .catch(error => {
          return Promise.resolve({
            error : error,
            email : email,
          });
        });
    }, {
      concurrency : 2,
    })
  })

  // Sort out successfully creted users and errors
  .then(users_or_errors => {
    let result = {
      users : [],
      errors : [],
    };

    users_or_errors.forEach( item => {
      item.hasOwnProperty('error')
        ? result.errors.push( item )
        : result.users.push( item )
    });

    /* Promise.map(
      result.users,
      user => {
          return user.promise_to_update_carried_over_allowance({
            year                   : 2019,
            carried_over_allowance : user.user_cf,
          })
      },
      {concurrency : 1}
    )*/

    return Promise.resolve(result);
  });

}

const validate_email_to_be_free_schema = Joi.object().required().keys({
    email : Joi.string().email().required(),
  });

function validate_email_to_be_free(args) {
  let validate_args = Joi.validate(args, validate_email_to_be_free_schema);

  if (validate_args.error) {
    Exception.throw_user_error({
      system_error : 'validate_email_to_be_free failed arguments validation',
      user_error   : 'Failed to validate email',
    });
  }

  return Models
    .User
    .find_by_email(args.email)
    .then(user => {

      if (user) {
        Exception.throw_user_error(
          'Email is already in use'
        );
      }

      return Promise.resolve();
  });
}

module.exports = {
  add_user                  : add_user,
  add_users_in_bulk         : add_users_in_bulk,
  validate_email_to_be_free : validate_email_to_be_free,
};

