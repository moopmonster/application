
/*
 * Book Leave request pop-up window.
 *
 * */
$(document).ready(function(){
  /*
   *  When FROM field in New absense form chnages: update TO one if necessary
   */
  $('input.book-leave-from-input').on('change', function(e){
    e.stopPropagation();

    var from_date = $('input.book-leave-from-input').datepicker('getDate');
    priorDateValidation();
    if ( ! from_date ) {
      // no new value for FROM part, do nothing
      console.log('No from date');
      return;
    }



    var to_date = $('input.book-leave-to-input').datepicker('getDate');

    if ( ! to_date || ( to_date && to_date.getTime() < from_date.getTime() )) {
      $('input.book-leave-to-input').datepicker('setDate', $('input.book-leave-from-input').datepicker('getFormattedDate'));
    }
  });
});

function priorDateValidation() {
    var from_date = $('input.book-leave-from-input').datepicker('getDate');
    // prior date validation
    var today = new Date();
    var validate_prior = parseInt($("select#leave_type").find('option:selected').attr('data-tom-prior'));
    if ( ! from_date ) {
      $('.data-tom-prior-error').remove();
      return;
    }
    if( validate_prior > 0 && (getBusinessDatesCount(today, from_date) < validate_prior) ){
      error_msg = '' + validate_prior + ' business days prior required. Please choose Emergency Leave type instead.';
      $('input.book-leave-from-input').val("");
      if($('.data-tom-prior-error').length==0) {
        $('input.book-leave-from-input').closest('[class^="col-md"]').append('<span class="data-tom-prior-error error text-danger">'+error_msg+'</span>');
      }
    }
    else $('.data-tom-prior-error').remove();
}

function getBusinessDatesCount(startDate, endDate) {
    var count = 1;
    var curDate = startDate;
    while (curDate <= endDate) {
        var dayOfWeek = curDate.getDay();
        if(!((dayOfWeek == 6) || (dayOfWeek == 0))) /* to add and public holiday */
           count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
}


/*
 * Bootstrap-datepicker
 *
 * */
!function(a){
  a.fn.datepicker.dates["en-GB"] = {
    days : [
      "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"
    ],
    daysShort : [
      "Sun","Mon","Tue","Wed","Thu","Fri","Sat"
    ],
    daysMin : [
      "Su","Mo","Tu","We","Th","Fr","Sa"
    ],
    months : [
      "January","February","March","April","May","June","July","August","September","October","November","December"
    ],
    monthsShort : [
      "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
    ],
    today       : "Today",
    monthsTitle : "Months",
    clear       : "Clear",
    weekStart   : 1,
    format      : "dd/mm/yyyy"
  }
}(jQuery);

$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

$(function () {
  $('[data-toggle="popover"]').popover()
})

/*
 * This is handler for invocation of "add secondary supervisors" modal
 *
 * */

$('#add_secondary_supervisers_modal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget),
      department_name = button.data('department_name'),
      department_id = button.data('department_id');

  var modal = $(this);

  modal.find('.modal-title strong').text(department_name);

  // Make modal window to be no hiegher then window and its content
  // scrollable
  $('.modal .modal-body').css('overflow-y', 'auto');
  $('.modal .modal-body').css('max-height', $(window).height() * 0.7);

  $(this).find(".modal-body")
    // Show "loading" icon while content of modal is loaded
    .html('<p class="text-center"><i class="fa fa-refresh fa-spin fa-3x fa-fw"></i><span class="sr-only">Loading...</span></p>')
    .load('/settings/departments/available-supervisors/'+department_id+'/');
});

/*
 *  Given URL string return its query paramters as object.
 *
 *  If URL is not provided location of current page is used.
 * */

function getUrlVars(url){
  if ( ! url ) {
    url = window.location.href;
  }
  var vars = {}, hash;
  var hashes = url.slice( url.indexOf('?') + 1).split('&');
  for (var i = 0; i < hashes.length; i++) {
    hash = hashes[i].split('=');
    vars[hash[0]] = hash[1];
  }
  return vars;
}

/*
 * Evend that is fired when user change base date (current month) on Team View page.
 *
 * */

$(document).ready(function(){

  $('#team_view_month_select_btn')
    .datepicker()
    .on('changeDate', function(e) {
      var url = $(e.currentTarget).data('tom');

      var form = document.createElement("form");
      form.method = 'GET';
      form.action = url;

      var url_params = getUrlVars( url );
      url_params['date'] = e.format('yyyy-mm');

      // Move query parameters into the form
      $.each( url_params, function(key, val){
        var inp = document.createElement("input");
        inp.name = key;
        inp.value = val;
        inp.type = 'hidden';
        form.appendChild(inp);
      });

      document.body.appendChild(form);

      return form.submit();
    });
});


$(document).ready(function(){

  $('[data-tom-color-picker] a')
    .on('click', function(e){
      e.stopPropagation();

      // Close dropdown
      $(e.target).closest('.dropdown-menu').dropdown('toggle');

      var new_class_name =  $(e.target).data('tom-color-picker-css-class');

      // Ensure newly selected color is on triggering element
      $(e.target).closest('[data-tom-color-picker]')
        .find('button.dropdown-toggle')
        .attr('class', function(idx, c){ return c.replace(/leave_type_color_\d+/g, '') })
        .addClass( new_class_name );

      // Capture newly picked up color in hidden input for submission
      $(e.target).closest('[data-tom-color-picker]')
        .find('input[type="hidden"]')
        .attr('value', new_class_name);

      return false;
    });
});


/*
 * leave request UI triggers
 *
 * */

$(document).ready(function(){
  $('select#leave_type')
    .on('change', function(e){
      var optsel = $(this).find('option:selected');
      var validate_comment = optsel.attr('data-tom-comment');

      // set compulsory comments
      toggleReq($('textarea#employee_comment'),(validate_comment==1?true:false));
      toggleReq($('input#from'),true);
      toggleReq($('input#to'),true);
      // from date
      priorDateValidation();

      return false;
    });

  // leave type
  $('select#leave_type').trigger("change");

});

function toggleReq(obj,flag)
{
  if(flag == true) {
    obj.prop("required",true);
    obj.closest(".form-group").addClass("required");
  }
  else {
    obj.removeProp("required");
    obj.closest(".form-group").removeClass("required");
  }
}