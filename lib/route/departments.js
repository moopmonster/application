
"use strict";

const express = require('express'),
    router    = express.Router(),
    validator = require('validator'),
    Promise   = require('bluebird'),
    _         = require('underscore');

// Make sure that current user is authorized to deal with settings
router.all(/.*/, require('../middleware/ensure_user_is_admin'));

function generate_all_department_allowances() {

  var allowance_options = [{ value : 0, caption : 'None'}],
    allowance = 0.5;

  while (allowance <= 50) {
    allowance_options.push({ value : allowance, caption : allowance });
    allowance += 0.5;
  }

  return allowance_options;
}

function get_and_validate_department(args) {
  var req             = args.req,
      index           = args.suffix,
      company         = args.company,
      // If no_suffix is set then parameter names are considered without "indexes"
      no_suffix        = args.no_suffix,
      department_name = args.department_name;

  // Get user parameters
  let
    name      = validator.trim(req.body[no_suffix ? 'name'      : 'name__'+index]),
    gcal_id   = validator.trim(req.body[no_suffix ? 'gcal_id'   : 'gcal_id__'+index]),
    allowance = validator.trim(req.body[no_suffix ? 'allowance' : 'allowance__'+index]),
    boss_id   = validator.trim(req.body[no_suffix ? 'boss_id'   : 'boss_id__'+index]),
    include_public_holidays = validator.toBoolean(
      req.body[no_suffix ? 'include_public_holidays' : 'include_public_holidays__'+index]
    ),
    is_accrued_allowance = validator.toBoolean(
      req.body[no_suffix ? 'is_accrued_allowance' : 'is_accrued_allowance__'+index]
    );

  // Validate provided parameters
  //
  // New allowance should be from range of (0;50]
  if (!validator.isFloat(allowance)) {
    req.session.flash_error(
      'New allowance for '+department_name+' should be numeric'
    );
  } else if (!((0 <= allowance) && (allowance <= 50))) {
    req.session.flash_error(
      'New allowance for '+department_name+' should be between 0.5 and 50 days'
    );
  }
  // New manager ID should be numeric and from within
  // current company
  if (!validator.isNumeric( boss_id ) ) {
    req.session.flash_error(
      'New boss reference for '+department_name+' should be numeric'
    );
  }
  // } else if ( ! _.contains( //Temporary remove the validation until 'proper' enhancement been done :P
  //   _.map( company.users, function(user){ return String(user.id) }), 
  //     String(boss_id)
  // )) {
  //   req.session.flash_error(
  //     'New boss for '+department_name+' is unknown'
  //   );
  // }

  return {
    bossId                  : boss_id,
    allowance               : allowance,
    include_public_holidays : include_public_holidays,
    is_accrued_allowance    : is_accrued_allowance,
    name                    : name,
    gcal_id                 : gcal_id
  };
}

router.get('/departments/', function(req, res){

  // Add JS that is specific only to current page
  res.locals.custom_java_script.push('/js/departments.js');

  var company_for_template,
    companies_name_list,
    company_filter = {},
    companies_id_list,
    manager_name_list = new Array(),
    model = req.app.get('db_model');

  if (req.user.superadmin != true){
    company_filter = {id : req.user.companyId};
  }

  // req.user.getCompany({
  // model.Company.findOne({
  //   scope : ['with_active_users', 'order_by_active_users'],
  // })
  model.Company.findAll({
    where : company_filter,
    include : [
      {
        model : model.User,
        as : 'users',
        // Remove this filter because it causing the some company will not appear in the department page
        //(If there's no manager/supervisor user in that company)
        // where : model.User.get_manager_user_filter(),
      },
    ],
    order : [
      [{model : model.User, as : 'users'}, 'nickname']
    ],
  })
  .then(function(companies){
    companies_name_list =  _.map(companies,company => company.name);
    companies_id_list =  _.map(companies,company => company.id);
    _.each(companies, function(company){ //push each manager user into the manager list
      _.each(company.users,function(c_user){
        if (c_user.is_manager()){
          manager_name_list.push(c_user);
        }
      })
    })
    company_for_template = companies;
    return Promise.all(
      _.map(companies,function(company){ 
        return company.getDepartments({
          scope : ['with_simple_users', 'with_boss'],
          order : [[ model.Department.default_order_field() ]],
        })
      })
    );
  })
  .then(function(result){
    res.render('departments_overview', {
      title             : 'Departments settings',
      // departments       : departments,
      companies         : company_for_template,
      allowance_options : generate_all_department_allowances(),
      companies_id      : companies_id_list,
      departments       : result,
      companies_name    : companies_name_list,
      manager_list      : manager_name_list,
    });
  });
});

router.post('/departments/:company_id', function(req, res){
  const
    model = req.app.get('db_model');

  let
    company_id = validator.trim(req.param('company_id'));

  model.Company.findOne({
    where   : {id : company_id},
    include : [{
      model : model.User,
      as : 'users',
      where : model.User.get_active_user_filter(),
    }]
  })
  // req.user.getCompany({
  //   scope : ['with_active_users'],
  // })
  .then(company => {

    let attributes = get_and_validate_department({
      req             : req,
      suffix          : 'new',
      company         : company,
      department_name : 'New department'
    });

    if ( req.session.flash_has_errors() ) {
      return Promise.resolve(1);
    }

    attributes.companyId = company.id;

    return model.Department.create(attributes);
  })

  .then(() => {
    if ( ! req.session.flash_has_errors() ) {
      req.session.flash_message('Changes to departments were saved');
    }

    return res.redirect_with_session('/settings/departments/');
  })

  .catch(error => {
    console.error(
      'An error occurred when trying to add department by user '+req.user.id
      + ' : ' + error
    );

    req.session.flash_error(
      'Failed to add new department, please contact customer service'
    );

    return res.redirect_with_session('/settings/departments/');
  });
});

router.post('/departments/delete/:department_id/', function(req, res){

  var department_id = req.params['department_id'],
    department_to_remove,
    model = req.app.get('db_model');

  if (!validator.isInt(department_id)) {
    console.error(
      'User '+req.user.id+' submited non-int department ID '+department_id
    );

    req.session.flash_error('Cannot remove department: wronge parameters');

    return res.redirect_with_session('/settings/departments/');
  }

  let CompanyfilterList = _.map(req.user.supervised_company,function(company){
      return company.id;
  })

  // console.log(filterList);
  model.Company.findOne({
    where : {id : CompanyfilterList},
    include : [
      {
        model : model.Department,
        as : 'departments',
        where : {
          id : department_id,
        }
      }
    ],
  })
  // req.user.getCompany()
  .then(function(company){
    return company.getDepartments({
      scope : ['with_simple_users'],
      where : {
        id : department_id,
      }
    });
  })
  .then(function(departments){
    department_to_remove = departments[ 0 ];

    // Check if user specify valid department number
    if (! department_to_remove) {

      req.session.flash_error('Cannot remove department: wrong parameters');

      throw new Error(
        'User '+req.user.id+' tried to remove non-existing department ID'+department_id
      );
    }

    if (department_to_remove.users.length > 0){
      req.session.flash_error(
        'Cannot remove department '+department_to_remove.name
          +' as it still has '
          +department_to_remove.users.length+' users.'
      );

      throw new Error('Department still has users');
    }

    // TODO VPP remove corresponding records in supervisors linking table
    return department_to_remove.destroy();
  })
  .then(function(){
    req.session.flash_message('Department was successfully removed');
    return res.redirect_with_session('/settings/departments/');
  })
  .catch(function(error){

    console.error(
      'An error occurred when trying to edit departments by user '+req.user.id+' : '+error
    );

    return res.redirect_with_session( department_to_remove
      ? '/settings/departments/edit/'+department_to_remove.get('id')+'/'
      : '/settings/departments/'
    );
  });
});

function promise_to_extract_company_and_department(req) {
  var department_id = req.params['department_id'],
      model = req.app.get('db_model'),
    // others,
    company_filters = {},
    company;

    return Promise.try(function(){

    if ( ! validator.isInt(department_id)) {
      throw new Error('User '+req.user.id+' tried to open department refered by  non-int ID '+department_id);
    }

    /* if (only_active) {
      return req.user.getCompany({
        scope : ['with_active_users', 'order_by_active_users'],
      });
    } else {
      return req.user.getCompany({
        scope : ['with_all_users'],
      });
    } */
    // return req.user.get_others(1);

    if (req.user.superadmin != true){
      company_filters = {id : req.user.companyId};
    }

    return model.Company.findAll({
      where   : company_filters,
      include : [{
        model : model.User,
        as : 'users',
        where : model.User.get_manager_user_filter(),
      }],
      order : [
        [{model : model.User, as : 'users'}, 'nickname']
      ]
    })
  })
  // .then(function(c){
  //   others = c;

  //   return req.user.getCompany({
  //     scope : ['with_manager_users', 'order_by_active_users'],
  //   });

  // })
  .then(function(c){
    company = c;

    if ( ! company ) {
      throw new Error('Cannot determine company!');
    }

    // return company.getDepartments({
    //   scope : ['with_simple_users', 'with_boss', 'with_supervisors'],
    //   where : {
    //     id : department_id,
    //   }
    // });
    return model.Department.findOne({
      include : [
        { model : model.User, as : 'users' },
        { model : model.User, as : 'boss' },
        { model : model.User, as : 'supervisors' },
      ],
      where : {
        id : department_id,
      }
    });
  })
  .then(function(department){
    // var department = departments;

    // Ensure we have database record for given department ID
    if ( ! department ) {
      throw new Error('Non existing department ID provided');
    }

    return Promise.resolve({
      company    : company,
      department : department,
      // others     : others[0]
    });
  });
}

router.get('/departments/edit/:department_id/', function(req, res){
  var department_id = req.params['department_id'];

  Promise.try(function(){
    return promise_to_extract_company_and_department(req);
  })
  .then(function(result){
    var department = result.department,
      company = result.company,
      others = result.others;

    res.render('department_details', {
      title      : 'Department details',
      department : department,
      company    : company,
      others     : others,
      allowance_options : generate_all_department_allowances(),
    });
  })
  .catch(function(error){
    console.error(
      'An error occurred when trying to edit department '+department_id
      +' for user '+req.user.id + ' : ' + error
    );

    req.session.flash_error(
      'Failed to fetch details for given department'
    );

    return res.redirect_with_session('/settings/departments/');
  });
});

router.post('/departments/edit/:department_id/', function(req, res){

  var department_id = req.params['department_id'],
    company,
    department;

  // to remove supervisor we need to get all users, not only active ones
  var only_active = !req.body.remove_supervisor_id

  Promise.try(function(){
    return promise_to_extract_company_and_department(req, only_active);
  })
  .then(function(result){
    company    = result.company;
    department = result.department;

    return Promise.resolve(1);
  })

  .then(function(){
    if (req.body.remove_supervisor_id) {
      return promise_to_remove_supervisor({
        supervisor_id : req.body.remove_supervisor_id,
        company       : company,
        department    : department,
      })
      .then(function(){
        req.session.flash_message('Supervisor was removed from ' + department.name);
        return Promise.resolve(1);
      });
    } else if ( req.body.do_add_supervisors ) { //Add secondary supervisor for department
      return promise_to_update_supervisors({
        req        : req,
        company    : company,
        department : department,
      })
      .then(function(){
        req.session.flash_message('Supervisors were added to department ' + department.name);
        return Promise.resolve(1);
      });
    }

    return promise_to_update_department({
      req        : req,
      company    : company,
      department : department,
    })
    .then(function(){
      req.session.flash_message('Department ' + department.name + ' was updated');
      return Promise.resolve(1);
    });
  })

  .then(function(){
    return res.redirect_with_session('.');
  })

  .catch(function(error){
    console.error(
      'An error occurred when trying to update secondary supervisors for department '+department_id
      +' by user '+req.user.id + ' : ' + error
    );

    req.session.flash_error(
      "Failed to update department's details"
    );

    return res.redirect_with_session('../../');
  });
});

function promise_to_remove_supervisor(args) {
  var
    supervisor_id = args.supervisor_id,
    company       = args.company,
    department    = args.department;

  // Make sure that provided supervisor ID belongs to user from current company
  // if (company.users.map(function(u){return String(u.id)}).indexOf( String(supervisor_id) ) === -1){ //temporary remove this :D
  //   return Promise.resolve(1);
  // }

  return  department.Model.sequelize.models.DepartmentSupervisor.destroy({
    where : {
      department_id : department.id,
      user_id       : supervisor_id,
    },
  });
}

function promise_to_update_supervisors(args) {

  var
    req        = args.req,
    company    = args.company,
    department = args.department;

  var supervisor_ids = req.body.supervisor_id || [];
  var tmpArray = [];
  // Take list of all users as a base of intersaction,
  // so we use submitted data only as criteria and do not save it in database
  // supervisor_ids = company.users //Temporary remove the checking first, will enable back when 'proper' enhancement for this :P
  //   .map(function(user){ return user.id})
  //   .filter(function(id){ return supervisor_ids.indexOf(String(id)) !== -1});
  if (typeof supervisor_ids === "string") //Convert String to Array
  {
    tmpArray.push(supervisor_ids)
    supervisor_ids = tmpArray;
  }

  var link_model = department.Model.sequelize.models.DepartmentSupervisor;

  return link_model.destroy({
    where : {
      department_id : department.id,
    }
  })
  .then(function(){
    return link_model.bulkCreate(
      supervisor_ids.map(function(id){ return { user_id : id, department_id : department.id  } })
    );
  });
}

function promise_to_update_department(args) {
  var
    req        = args.req,
    company    = args.company,
    department = args.department;

  var attributes = get_and_validate_department({
    company         : company,
    department_name : department.name,
    no_suffix       : true,
    req             : req,
  });

  // If there were any validation errors: do not update department
  if ( req.session.flash_has_errors() ) {
    throw new Error("Invalid parameters submitted while while attempt to update department details");
  }

  return department.updateAttributes(attributes);
}

router.get('/departments/available-supervisors/:department_id/', function(req, res){

  var department_id = req.params['department_id'],
    department,
    companies;

  Promise.try(function(){
    return promise_to_extract_company_and_department(req);
  })

  .then(function(result){
    department = result.department;
    companies  = result.company;

    return department.promise_me_with_supervisors();
  })

  .then(function(department_with_supervisors){
    var supervisor_map = {};

    department_with_supervisors.supervisors.forEach(function(user){
      supervisor_map[user.id] = true;
    });

    var UsersList = _.flatten(
      _.map(companies,function(company){
        // console.log(company);
        return _.map(
          _.filter(company.users, function(user){ return user.id !== department.bossId }),
          function(user){ user._marked = supervisor_map[user.id]; return user }
        )
      })
    );

    res.render('department/available_supervisors', {
      layout : false,
      // users  : _.map(
      //   _.filter(company.users, function(user){ return user.id !== department.bossId }), //department manager cannot be selected as secondary supervisor
      //   function(user){ user._marked = supervisor_map[user.id]; return user }
      // ),
      users  : UsersList,
    });
  })
  .catch(function(error){
    console.error(
      'An error occurred when trying to get all available supervisors for department '+department_id
      +' for user '+req.user.id + ' : ' + error
    );

    res.send('REQUEST FAILED');
  });
});

module.exports = router;
