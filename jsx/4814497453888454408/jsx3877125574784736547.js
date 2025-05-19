require(['jquery', 'xwiki-meta'], function ($, xm) {
  'use strict';
  
  var performChange = function (chosenOption) {
    var restUrl = xm.restURL.replace(/\/translations.*/, "");
    var queryParams = new URLSearchParams({
      "form_token": xm.form_token
    });
    var method = "PUT";
    if (chosenOption === 'watchPage') {
      var url = restUrl;
    } else if (chosenOption === 'watchSpace') {
      var url = restUrl.replace(/\/pages.*/, "");
    } else if (chosenOption === 'watchWiki') {
      var url = restUrl.replace(/\/spaces.*/, "");
    } else if (chosenOption == 'unwatchPage' || chosenOption == 'unblockPage') {
      var url = restUrl;
      method = 'DELETE';
    } else if (chosenOption == 'unwatchSpace' || chosenOption == 'unblockSpace') {
      var url = restUrl.replace(/\/pages.*/, "");
      method = 'DELETE';
    } else if (chosenOption == 'unwatchWiki' || chosenOption == 'unblockWiki') {
      var url = restUrl.replace(/\/spaces.*/, "");
      method = 'DELETE';
    } else if (chosenOption == 'blockPage') {
      var url = restUrl;
      queryParams.append("ignore", "true");
    } else if (chosenOption == 'blockSpace') {
      var url = restUrl.replace(/\/pages.*/, "");
      queryParams.append("ignore", "true");
    } else if (chosenOption == 'blockWiki') {
      var url = restUrl.replace(/\/spaces.*/, "");
      queryParams.append("ignore", "true");
    } else {
      console.error("Option " + chosenOption + " is not yet supported!");
    }
    if (url) {
      var ajaxUrl = url + "/notificationsWatches?" + queryParams.toString();
      return $.ajax(ajaxUrl, {
          method: method
      });
    }
  };
  
  var handleSubmit = function () {
    var chosenOption = $('#watchModal input[type="radio"]:checked').val();
    var promise;
    if (chosenOption == 'unwatchPageWatchSpace') {
      var firstPromise = performChange('unwatchPage');
      if (firstPromise !== 'undefined') {
        promise = firstPromise.pipe(performChange('watchSpace'))
      }
    } else if (chosenOption == 'unblockPageBlockSpace') {
      var firstPromise = performChange('unblockPage');
      if (firstPromise !== 'undefined') {
        promise = firstPromise.pipe(performChange('blockSpace'))
      }
    } else {
      promise = performChange(chosenOption);
    }
    if (promise !== 'undefined') {
      promise.done(function () {
        removeAnySelection();
        window.location.reload();
      }).error(function (data) {
        removeAnySelection();
        console.error("Error when processing the request: " + data);
      });
    }
  };
  
  var removeAnySelection = function() {
      $('#watchModal input[type="radio"]').each(function () {
        $(this).prop('checked', '');
        $('#watchModal .btn-primary').prop('disabled', true);
      });
  };
  
  var initWatchModal = function () {
    $('#watchModal .btn-primary').on('click', handleSubmit);
    $('#watchModal input[type="radio"]').on('change', function () {
      $('#watchModal .btn-primary').prop('disabled', false);
    });
    $('#watchModal input[type="radio"]').each(function () {
      var radioButton = $(this);
      var titleId = radioButton.attr('aria-labelledby');
      $('#' + titleId).parent('a').on('click', function() {
        radioButton.prop('checked', 'checked');
        $('#watchModal .btn-primary').prop('disabled', false);
      });
    });
    $('#watchModal .close-modal').on('click', removeAnySelection);
  };
  
  (XWiki.isInitialized && initWatchModal()) || document.on('xwiki:dom:loaded',initWatchModal);
});
