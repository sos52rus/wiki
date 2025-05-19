require(['jquery', 'bootstrap'], function($) {
  $(function() {

    // Some variables used in the next 2 functions
    var globalSearch = $('#globalsearch');
    var globalSearchInput = globalSearch.find('input');
    var globalSearchButton = globalSearch.find('button');

    //Expand or retract the global search
    function showSearchInput() {
      globalSearchInput.removeAttr('disabled');
      globalSearch.removeClass('globalsearch-close');
      globalSearchButton.attr('aria-expanded', 'true');
      globalSearchInput.trigger('focus');
    }
    function hideSearchInput() {
      globalSearch.addClass('globalsearch-close');
      globalSearchButton.attr('aria-expanded', 'false');
      globalSearchInput.attr('disabled','');
      document.fire('xwiki:suggest:collapsed');
    }

    // Open the global search when the user click on the global search button
    globalSearchButton.on('click', function() {
      if (!globalSearch.hasClass('globalsearch-close') && globalSearchInput.val().length > 0) {
        return true;
      }
      if (globalSearch.hasClass('globalsearch-close')) {
        showSearchInput();
      } else {
        hideSearchInput();
      }
      return false;
    });

    // Close the global search when the focus is lost
    globalSearch.on('focusout', function() {
      // In order to let the main thread setting the focus to the new element, we execute the following code
      // in a callback.
      setTimeout( function () {
        // We close the global search only if the focus is not on the search input or the search button.
        // Without this, the global search would be close each time the user click on the button (even when it's for
        // actually performing the search).
        if (!document.getElementById('globalsearch').contains(document.activeElement)) {
          hideSearchInput();
        }
      }, 1);
    });

    // Close dropdown menus when the search button is clicked
    globalSearchButton.on('click', function() {
      $('[data-toggle="dropdown"][aria-expanded="true"]').dropdown('toggle');
    });

  });
});
