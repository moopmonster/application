
'use strict';

var validator = require('validator'),
    moment    = require('moment'),
    LeaveRequestParameters = require('../../model/leave_request_parameters');

module.exports = function(args){
    var req = args.req;

    var user             = validator.trim( req.param('user') ),
        leave_type       = validator.trim( req.param('leave_type') ),
        from_date        = validator.trim( req.param('from_date') ),
        from_date_part   = validator.trim( req.param('from_date_part') ),
        to_date          = validator.trim( req.param('to_date') ),
        to_date_part     = validator.trim( req.param('to_date_part') ),
        employee_comment = validator.trim( req.param('employee_comment') );

    if (user && !validator.isNumeric(user)){
        req.session.flash_error('Incorrect employee');
    }

    if (!validator.isNumeric(leave_type)){
        req.session.flash_error('Incorrect leave type');
    }

    var date_validator = function(date_str, label) {
      try {

        // Basic check
        if (! date_str ) throw new Error("date needs to be defined");

        date_str = req.user.company.normalise_date(date_str);

        // Ensure that normalisation went OK
        if (! validator.isDate(date_str)) throw new Error("Invalid date format");

      } catch (e) {
        console.log('Got an error ' + e);
        req.session.flash_error(label + ' should be a date');
      }
    }

    date_validator(from_date, 'From date');

    if (  !validator.matches(from_date_part, /^[123]$/)
       || !validator.matches(to_date_part, /^[123]$/)
     ){
        req.session.flash_error('Incorrect day part');
    }

    date_validator(to_date, 'To date');

    // within one day, must be ALLDAY to full day, morning, or evening
    if(from_date === to_date && from_date_part != to_date_part) {
        if ((from_date_part == 2 || from_date_part == 3) && (to_date_part == 2 || to_date_part == 3))
            req.session.flash_error("For 0.5 day leave, please select Morning -> Morning for (AM), or Afternoon to Afternoon for (PM)");
        else 
            req.session.flash_error("For 1 day leave, please select All Day -> All Day only");
    }
    else if (from_date !== to_date) 
    {
      if(from_date_part==2) // auto adjust AM to full day. 
        from_date_part=1;
      if(to_date_part==3) // auto adjust PM to full day. 
        to_date_part=1;
    }

    if(moment(from_date,req.user.company.get_default_date_format()).year() < 2019)
        req.session.flash_error("Can only create leaves starting from 2019 onwards. ");

    // Check if it makes sence to continue validation (as following code relies on
    // to and from dates to be valid ones)
    if ( req.session.flash_has_errors() ) {
      throw new Error( 'Got validation errors' );
    }

    // Convert dates inot format used internally
    from_date = req.user.company.normalise_date(from_date);
    to_date = req.user.company.normalise_date(to_date);

    if (from_date.substr(0,4) !== to_date.substr(0,4)) {
        req.session.flash_error('Current implementation does not allow inter year leaves. Please split your request into two parts');
    }

    if ( req.session.flash_has_errors() ) {
      throw new Error( 'Got validation errors' );
    }

    var valid_attributes = {
        leave_type       : leave_type,
        from_date        : from_date,
        from_date_part   : from_date_part,
        to_date          : to_date,
        to_date_part     : to_date_part,
        employee_comment : employee_comment,
    };

    if ( user ) {
        valid_attributes.user = user;
    }

    return new LeaveRequestParameters( valid_attributes );
};
