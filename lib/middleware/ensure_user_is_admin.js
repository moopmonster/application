/*
 * Midleware that checks if current session has a user and user is an admin.
 *
 * In case of failure - redirects to the route.
 *
 * */
"use strict";

module.exports = function(req, res, next){

    // User should be login to view settings pages
    if ( !req.user ) {
    	   req.session.flash_error("Please login to the system first before proceed")
        return res.redirect_with_session(303, '/');
    }

    // Only Admin users allowed to deal with settings pages
    if ( !req.user.is_admin()) {
    	   req.session.flash_error("You do not have the permission to visit the page")
        return res.redirect_with_session(303, '/');
    }

    next();
};
