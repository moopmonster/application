
"use strict";

const crypto = require("crypto");

var express   = require('express'),
    multer    = require('multer'),
    router    = express.Router(),
    storage   = multer.diskStorage({
      destination : (req, file, cb) => {
        cb(null, './attachments/temp');
      },
      filename : (req, file, cb) => {
        cb(null, file.originalname);
      }
    }),
    upload    = multer({ storage: storage}),
    Promise   = require('bluebird'),
    moment    = require('moment'),
    validator = require('validator'),
    _         = require('underscore'),
    LeaveCollectionUtil = require('../model/leave_collection')(),
    EmailTransport      = require('../email'),
    GcalEvent           = require('../gcal'),
    fs = require('fs'),
    AttachmentDir = require('path').join(__dirname,'../../attachments');

router.get('/approve/', function(req, res){
    Promise.join(
        req.user.promise_leaves_to_be_processed(),
        (req.user.is_admin()?req.user.promise_leaves_to_be_verified():null),
        req.user.get_company_with_all_leave_types(),
        function(to_be_approved_leaves,to_be_verified_leaves, company){

            res.render('requests_approve',{
                to_be_approved_leaves : to_be_approved_leaves,
                to_be_verified_leaves : to_be_verified_leaves,
                company               : company,
            });

        }
    );
});

router.use('/approve/attachments/',express.static(AttachmentDir));

router.get('/', function(req, res){
    Promise.join(
        req.user
          .promise_my_active_leaves_ever()
          .then(leaves => LeaveCollectionUtil.promise_to_group_leaves(leaves)),
        req.user.get_company_with_all_leave_types(),
        function(my_leaves_grouped, company){

              res.render('requests',{
                  my_leaves_grouped     : my_leaves_grouped,
                  company               : company,
              });
        }
    );
});


function leave_request_action(args) {
    var
      current_action      = args.action,
      leave_action_method = args.leave_action_method,
      was_pended_revoke   = false;

    return function(req, res){

    var request_id = validator.trim( req.param('request') );
    var comment = validator.trim( req.param('comment') ) || "";

    if (!validator.isNumeric(request_id)){
      req.session.flash_error('Failed to ' + current_action);
    }

    if ( req.session.flash_has_errors() ) {
      console.error('Got validation errors on '+current_action+' request handler');

      return res.redirect_with_session('../');
    }

    Promise.try(function(){
      return req.user.promise_leaves_to_be_processed();
    })
    .then(function(leaves){
       var leave_to_process = _.find(leaves, function(leave){
          return String(leave.id) === String(request_id)
            && (leave.is_new_leave() || leave.is_pended_revoke_leave());
       });

       if (! leave_to_process) {
         throw new Error('Provided ID '+request_id
           +'does not correspond to any leave requests to be '+current_action
           +'ed for user ' + req.user.id
          );
       }

       was_pended_revoke = leave_to_process.is_pended_revoke_leave();  
            
       if(current_action == "approve" && leave_to_process.get_leave_type_adjustment() > 0)
       {
          req.user.promise_to_add_adjustment({leave:leave_to_process, employee: leave_to_process.user, user_id:leave_to_process.userId, leave_type:leave_to_process.leave_type});
       }

       return leave_to_process[leave_action_method]({ by_user : req.user, comment : comment, });
    })
    .then(function(processed_leave){
      return processed_leave.reload({
        include : [
          {model : req.app.get('db_model').User, as : 'user'},
          {model : req.app.get('db_model').User, as : 'approver'},
          {model : req.app.get('db_model').LeaveType, as : 'leave_type' },
        ],
      });
    })
    .then(function(processed_leave){

      var Email = new EmailTransport();

      /* update google calendar event */
      var gcal = new GcalEvent();      
      gcal.promise_leave_request_decision_gevent({leave : processed_leave,});

      return Email.promise_leave_request_decision_emails({
        leave             : processed_leave,
        action            : current_action,
        was_pended_revoke : was_pended_revoke,
      })
      .then(function(){
        return Promise.resolve( processed_leave);
      });
    })
    .then(function(processed_leave){
      req.session.flash_message('Request from '+processed_leave.user.full_name()
          +' - '+current_action+' successful');

      return res.redirect_with_session('../approve/');
    })
    .catch(function(error){
      console.error('An error occurred when attempting to '+current_action
        +' leave request '+request_id+' by user '+req.user.id+' Error: '+error
      );
      req.session.flash_error('Failed to '+current_action);
      return res.redirect_with_session('../');
    });
  };

};

router.post(
  '/reject/',
  leave_request_action({
    action              : 'reject',
    leave_action_method : 'promise_to_reject',
  })
);

router.post(
  '/approve/',
  leave_request_action({
    action              : 'approve',
    leave_action_method : 'promise_to_approve',
  })
);

router.post('/verify/', function(req,res) {

    var verify_one = validator.trim( req.param('verify_one') ) || "";
    var verify_list = validator.trim( req.param('verify_list') ) || "";

    if(verify_one == "" && verify_list == "")
    {
      req.session.flash_error('Failed to verify, no leave request ids received.');
      return res.redirect_with_session('/requests/approve/'); 
    }

    Promise.try(() => {req.user.verify_leaves(verify_one,verify_list,req.user.id)})
    .then(() => {req.session.flash_message('Leave request verified.')})
    .catch((error) => {req.session.flash_error('Failed to verify leave request. [' + verify_one + verify_list + ']')} )
    .finally(() => res.redirect_with_session('/requests/approve/'));

  }
);

router.post('/cancel/', function(req, res){

  var request_id = validator.trim( req.body['request'] );

  Promise.try(function(){
    return req.user.promise_cancelable_leaves()
  })
  .then(function(leaves){
     var leave_to_cancel = _.find(leaves, function(leave){
        return String(leave.id) === String(request_id);
     });

    if ( ! leave_to_cancel ) {
      throw new Error('Given leave request is not among those current user can cancel');
    }

    return Promise.resolve(leave_to_cancel);
  })
  .then(function(leave){
    return leave.promise_to_cancel()
      .then(function(){ return Promise.resolve(leave)});
  })
  .then(function(leave){
    return leave.reload({
      include : [
        {model : req.app.get('db_model').User, as : 'user'},
        {model : req.app.get('db_model').User, as : 'approver'},
        {model : req.app.get('db_model').LeaveType, as : 'leave_type' },
      ],
    });
  })
  .then(function(leave){

    var gcal = new GcalEvent();      
    gcal.promise_leave_request_decision_gevent({leave : leave,});

    var Email = new EmailTransport();

    return Email.promise_leave_request_cancel_emails({
      leave : leave,
    })
    .then(function(){
      return Promise.resolve(leave);
    });
  })
  .then(function(leave){
    req.session.flash_message('The leave request was canceled');
  })
  .catch(function(error){
    console.log('An error occurred: '+error);
    req.session.flash_error('Failed to cancel leave request');
  })
  .finally(function(){
    return res.redirect_with_session('/requests/');
  });
});

router.post(
  '/revoke/',
  function(req, res){
    var request_id = validator.trim( req.body['request'] );

    // TODO NOTE revoke action now could be made from more then one place,
    // so make sure that user is redirected to correct place

    if (!validator.isNumeric(request_id)){
      req.session.flash_error('Failed to revoke leave request');
    }

    if ( req.session.flash_has_errors() ) {
      console.log(
        'Got validation errors when revoking leave request for user ' + req.user.id
      );

      return res.redirect_with_session('../');
    }

    Promise
      // Get the Leave object for submitted ID
      .try(() => req.app.get('db_model').Leave.findOne({ where : { id : request_id }}))

      // Ensure that current user can act on this Leave object
      .then(requested_leave => {

        // Case when requested Leave is originated from current user
        if ( String(requested_leave.userId) === String(req.user.id) ) {
          return Promise.resolve( requested_leave )
        }

        // Case when requested Leave is originated from one of employees
        // current user can manage
        return req.user
          .promise_users_I_can_manage()
          .then(users => {
            if ( users.find(u => String(u.id) === String(requested_leave.userId)) ) {
              return Promise.resolve( requested_leave );
            }

            return Promise.resolve();
          });
      })

      .then(leave_to_process => {

        // Ensure that Leave is in status from it could be revoked
        if (! leave_to_process) {
          throw new Error('Provided ID '+request_id
            +' does not correspond to any leave requests to be revoked by user '
            + req.user.id
           );
        }

        // Do the action
        return leave_to_process.promise_to_revoke();
      })

      // Ensure that Leave object has all content necessary for sending emails
      .then(processed_leave => processed_leave.reload({
        include : [
          {model : req.app.get('db_model').User, as : 'user'},
          {model : req.app.get('db_model').User, as : 'approver'},
          {model : req.app.get('db_model').LeaveType, as : 'leave_type' },
        ],
      }))

      // Send relevant emails
      .then(processed_leave => {
        
        var gcal = new GcalEvent();      
        gcal.promise_leave_request_decision_gevent({leave : processed_leave,});

        var Email = new EmailTransport();

        return Email.promise_leave_request_revoke_emails({
          leave  : processed_leave,
        })
        .then(function(){
          return Promise.resolve(processed_leave);
        });
      })

      // Deal with next page: where to land and what to show
      .then(processed_leave => {
        req.session.flash_message(
          'You have requested leave to be revoked. '
          + (
            processed_leave.user.is_auto_approve()
            ? ''
            : 'Your supervisor needs to approve it'
          )
        );

        return res.redirect_with_session('../');
      })

      // Deal with issues if any occurs
      .catch(error => {
        console.error('An error occurred when attempting to revoke leave request '
            +request_id+' by user '+req.user.id+' Error: '+error
        );
        req.session.flash_error('Failed to revoke leave request');
        return res.redirect_with_session('../');
      });
  }
);

//next three post methods are for downloading/uploading attachments

router.post('/reqdownload/', function(req, res) {
  // a lot of code smell...
  // 1. Get file path from request id
  // 2. post response with file stream (res.download)
  var request_id = validator.trim( req.param('request') );

  // todo: add checking that this is admin/HR for access of any request_id
  Promise.try(function() {return req.user.promise_leaves_with_attachments(request_id);})
  .then(function(leaves) {
    var leave_to_download = _.find(leaves, function(leave){
      return String(leave.id) === String(request_id);
    });
    if (! leave_to_download) {
      throw new Error('Could not find leave to download from.');
    }
    return Promise.resolve(leave_to_download);
  })
  .then(function(leave_to_download) {
    return res.download(leave_to_download.attachment);
  })
  // var path = foo;
  // res.download(path);
});

router.post('/usrdownload/', function(req, res) {
  // 1. Get file path from request id
  // 2. post response with file stream (res.download)
  var request_id = validator.trim( req.param('request') );

  // todo: add checking that this is admin/HR for access of any request_id
  Promise.try(function() {return req.user.promise_leaves_with_attachments(request_id);})
  .then(function(leaves) {
    var leave_to_download = _.find(leaves, function(leave){
      return String(leave.id) === String(request_id);
    });
    if (! leave_to_download) {
      throw new Error('Could not find leave to download from.');
    }
    return Promise.resolve(leave_to_download);
  })
  .then(function(leave_to_download) {
    return res.download(leave_to_download.attachment);
  })
  // var path = foo;
  // res.download(path);
});

router.post('/upload/', upload.single('attachment'), function(req,res) {
  // 1. Upload file and save in ./attachments/
  // 2. Rename file accordingly
  // 3. Update attachment column with file path
  // 4. refresh page
  
  var randomid = crypto.randomBytes(16).toString("hex");
  var request_id = validator.trim( req.param('request') );
  Promise.try(function() {return req.user.promise_my_active_leaves_ever();})
  .then(function(leaves) {
    var leave_to_upload = _.find(leaves, function(leave) {
      return String(leave.id) === String(request_id);
    });
    if (! leave_to_upload) {
      throw new Error('Could not find leave to upload to.');
    }
    return Promise.resolve(leave_to_upload);
  })
  .then(function(leave_to_upload) {
    var newname = randomid +"-"+ req.file.originalname;
    var newpath = "./attachments/" + newname;
    fs.rename(req.file.path, newpath, function(err) {if(err) throw err;});
    return leave_to_upload.promise_to_upload(newpath);
  })
  .then(function() {
    return res.redirect_with_session("../");
  });
});

module.exports = router;
