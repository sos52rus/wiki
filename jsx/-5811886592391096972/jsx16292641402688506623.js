
//----------------------------------
// RequireJS configuration
//----------------------------------
require.config({
  paths: {
          'bootstrap-tour': "../../webjars/bootstrap-tour/0.12.0/js/bootstrap-tour.min.js"
      },
  shim: {
    'bootstrap-tour': {
      deps: ['bootstrap', 'jquery'],
      exports : 'Tour'
    }
  }
});
//----------------------------------
// Display a tour if needed
//----------------------------------
require(['jquery', 'xwiki-meta'], function ($, xm) {
  'use strict';

  /**
   * Escape strings so they respect the Tour API constraints.
   */
  var escapeTourName = function (tourName) {
    // The Tour API says tour name must contain only alphanumerics, underscores and hyphens.
    // So we replace any forbidden character by its ASCII value, surrounded by an underscore (that we forbid too to 
    // avoid collisions).
    return tourName.replace(/[^a-zA-Z0-9\-]/g, function(character) {
      return '_'+character.charCodeAt(0)+'_';
    });
  };

  /**
   * Add a resume button to start the tour again when it has been closed
   */
  var createResumeButton = function (tour, showPopover) {
    // Create a container when the button will be displayed. This container will also contains the "popover", so the "popover" stay near the button when the page is resized.
    // (see http://getbootstrap.com/javascript/#popovers-options 'container')
    var buttonContainer = $('<div id="tourResumeContainer"></div>').appendTo($(document.body));
    // Create the popover
    var popover = $('<div class="popover-content">\u0412\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0442\u0443\u0440 \u0432 \u043B\u044E\u0431\u043E\u0439 \u043C\u043E\u043C\u0435\u043D\u0442, \u043D\u0430\u0436\u0430\u0432 \u043D\u0430 \u044D\u0442\u0443 \u043A\u043D\u043E\u043F\u043A\u0443</div>').appendTo(buttonContainer);
    // Create the button that will start the tour again
    const button = $('<button id=\'tourResume\' class=\'btn btn-default btn-xs\'></button>')
      .html("<span class=\"fa fa-info-circle\" aria-hidden=\"true\"><\/span> \u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0442\u0443\u0440")
      .appendTo(buttonContainer);

    if (showPopover) {
      buttonContainer.addClass('opened');
      button.removeAttr('hidden');
      popover.attr('open','open');
    }

    button.on('click', function() {
      if (showPopover) {
        popover.removeAttr('open');
        button.attr('hidden', true);
        buttonContainer.removeClass('opened');
      }

      if (window.localStorage.getItem(tour._options.name + '_current_step') != tour._options.steps.length - 1) {
        // Make sure we can redirect again to the current step.
        window.localStorage.removeItem(tour._options.name + '_redirect_to');
        // We don't rely on the force parameter because it is lost on redirect. Instead, we just remove the flag that
        // marks the tour as finished.
        window.localStorage.removeItem(tour._options.name + '_end');
        tour.start(true);
      } else {
        tour.restart();
      }
      button.attr('hidden', true);
      buttonContainer.removeClass('opened');
    });
  }

  /**
   * The template to display a step.
   */
  var getTemplate = function (index, step) {
    var idPrefix = 'bootstrap_tour';
    var template = '<div class="popover tour" style="min-width: 300px;">\n'
                 + ' <a class="btn btn-xs btn-default" href="#" id="'+idPrefix+'_close" aria-label="\u041F\u0440\u0435\u043A\u0440\u0430\u0442\u0438\u0442\u044C \u0442\u0443\u0440" title="\u041F\u0440\u0435\u043A\u0440\u0430\u0442\u0438\u0442\u044C \u0442\u0443\u0440"><span class=\"fa fa-times\" aria-hidden=\"true\"><\/span></a>\n'
                 + '  <div class="arrow"></div>\n'
                 + '  <h2 class="popover-title"></h2>\n'
                 + '  <div class="popover-content"></div>\n'
                 + '  <div class="popover-navigation">\n'
                 + '    <div class="col-xs-6 text-left">\n';
    if (step.prev > -1) {
      template  += '      <a class="btn btn-default btn-sm" href="#" id="'+idPrefix+'_prev">\u00AB \u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439</a>\n';
    }
    template    += '    </div>\n'
                 + '    <div class="col-xs-6 text-right">\n';
    if (step.next > -1) {
      template  += '      <a class="btn btn-primary btn-sm" href="#" id="'+idPrefix+'_next">\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u00BB</a>\n';
    } else {
      template  += '      <a class="btn btn-success btn-sm" href="#" id="'+idPrefix+'_end">\u041A\u043E\u043D\u0435\u0446 \u0442\u0443\u0440\u0430</a>\n'
    }
    template    += '    </div>\n'
                 + '  </div>'
                 + '</div>';
    return template;
  }

  /**
   * Associate the template buttons to their actions on the tour
   */
  var onShown = function (tour) {
      var idPrefix = 'bootstrap_tour';
      var closeButtonSelector = '#' + idPrefix + '_close';
      var endButtonSelector = '#' + idPrefix + '_end';
      var prevButtonSelector = '#' + idPrefix + '_prev';
      var nextButtonSelector = '#' + idPrefix + '_next';

    $(closeButtonSelector)
      .on('click', function (event) {
        tour.end();
        event.preventDefault();
      })
      .on('keypress', function (event) {
        if (event.which === 32 || event.which === 13) {
          tour.end();
        }
        event.stopImmediatePropagation();
        event.preventDefault();
      })
      .on('focusout', function (event) {
        if (event.relatedTarget !== null && !event.currentTarget.parentNode.contains(event.relatedTarget)) {
          $(nextButtonSelector + ', ' + endButtonSelector).focus();
        }
      });

    $(endButtonSelector)
      .on('click', function (event) {
        tour.end();
        event.preventDefault();
      })
      .on('keypress', function (event) {
        // Activate the anchor/button when space or enter are pressed down
        if (event.which === 32 || event.which === 13) {
          tour.end();
        }
        event.stopImmediatePropagation();
        event.preventDefault();
      });

    $(prevButtonSelector)
      .on('click', function (event) {
        tour.prev();
        event.preventDefault();
      })
      .on('keypress', function (event) {
        // Activate the anchor/button when space or enter are pressed down
        if (event.which === 32 || event.which === 13) {
          tour.prev();
        }
        event.stopImmediatePropagation();
        event.preventDefault();
      })
      .on('focusout', function (event) {
        if (event.relatedTarget !== null && !event.currentTarget.parentNode.parentNode.parentNode.contains(event.relatedTarget)) {
          $(nextButtonSelector + ', ' + endButtonSelector).focus();
        }
      });

    $(nextButtonSelector)
      .on('click', function (event) {
        tour.next();
        event.preventDefault();
      })
      .on('keypress', function (event) {
        // Activate the anchor/button when space or enter are pressed down
        if (event.which === 32 || event.which === 13) {
          tour.next();
        }
        event.stopImmediatePropagation();
        event.preventDefault();
      });

    // Wrap around in tab order when the popover is opened, and focus the 'Next' button when the tour step is opened.
    $(nextButtonSelector + ', ' + endButtonSelector)
      .on('focusout', function (event) {
        if (event.relatedTarget !== null && !event.currentTarget.parentNode.parentNode.parentNode.contains(event.relatedTarget)) {
          $(closeButtonSelector).focus();
        }
      })
      .focus();

    // Avoid having the close button on top of the title
    $('.tour .popover-title').css('padding-right',  $(closeButtonSelector).outerWidth() + 10 + 'px');
    $('.tour').on('keydown', function (event) {
      // Exit the tour if the escape key is pressed down.
      if (event.which === 27) {
        tour.end();
        event.stopImmediatePropagation();
        event.preventDefault();
        $('.tour').off('keydown');
      }
    });
  }

  /**
   * Create a tour from a JSON file
   */
  var createTour = function (jsonData) {
    // Add stylesheet only when needed
    var cssURL = "../../webjars/bootstrap-tour/0.12.0/css/bootstrap-tour.min.css";
    $('<link/>').attr('rel', 'stylesheet').attr('type', 'text/css').attr('href', cssURL).appendTo($(document.head));

    // Require 'bootstrap-tour' only when needed
    require(['bootstrap-tour'], function(Tour) {

      // Create the tour
      var tourName = escapeTourName('tour_' + jsonData.name);
      var tour     = new Tour({
        name    : tourName,
        storage : window.localStorage,
        onEnd   : function() {
          let buttonContainer = $('#tourResumeContainer');
          if (buttonContainer.length === 0) {
            createResumeButton(tour, true);
          } else {
            buttonContainer.addClass('opened');
            let button = $('#tourResume');
            button.removeAttr('hidden');
            // Show the popover
            let popover = buttonContainer.find('.popover-content').first();
            popover.attr('open','open');
            // Hide it after 7 seconds
            setTimeout(function() {
              buttonContainer.removeClass('opened');
              popover.removeAttr('open');
            }, 7000);
          }
        },
        onShown : onShown,
        orphan  : false,
        container: "#contentcontainer",
        template: getTemplate
      });

      // Create the steps
      for (var i = 0; i < jsonData.steps.length; i++) {
        tour.addStep(jsonData.steps[i]);
      }

      // Look if the tour should be started regardless of its status on the local storage
      var getQueryStringParameterByName = function (name) {
        var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
        return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
      }
      var forceStart = getQueryStringParameterByName('startTour') == 'true';

      var tourEnded = window.localStorage.getItem(tourName + '_end') === 'yes';
      // Initialize the current step index from local storage.
      tour.setCurrentStep();
      var currentStep = tour.getStep(tour.getCurrentStep() || 0);
      var tourNeedsRedirect = tour._isRedirect(currentStep.host, currentStep.path, document.location);
      var tourAutoStart = !tourEnded && !tourNeedsRedirect;

      // Launch the tour.
      if (forceStart) {
        tour.restart();
      } else if (tourAutoStart) {
        tour.start();
      }

      // Create a resume button if the tour has already been closed by the user in the past.
      if (!tourAutoStart) {
        createResumeButton(tour, false);
      }
    });
  };

  /**
   * Load asynchronously the list of steps concerning the current page.
   * It's done asynchronously so it does not improve the page rendering time. It's important since this code is used
   * everywhere.
   */
  $(function() {

    /**
     * The tour is not adapted for little screen sizes like mobile phones have.
     * The value 768 is taken from bootstrap in order to be consistent with their media queries.
     */
    if ($(window).innerWidth() <= 768) {
      return;
    }

    $.getJSON(new XWiki.Document('TourJson', 'TourCode').getURL('get'), {
      xpage: 'plain',
      outputSyntax: 'plain',
      tourDoc: xm.document
    }).done(function(json) {
      for (var i = 0; i < json.tours.length; ++i) {
        var tour = json.tours[i];
        if (tour.steps.length > 0) {
          createTour(tour);
        }
      }
    });
  });
});
