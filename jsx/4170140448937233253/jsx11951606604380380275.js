require(['jquery', 'bootstrap'], function($) {
  // Don't follow the category link on click. Just expand/collapse the category.
  $(document).on('click', '.admin-menu a.panel-heading', function(event) {
    event.preventDefault();
  });
  // Mark the administration menu as ready for user interaction.
  $('.admin-menu').attr('data-ready', true);
});

/**
 * Live search in the category/section name and description.
 */
require(['jquery'], function($) {
  var filterItem = function(text) {
    var name = $(this).text().toLowerCase();
    var description = ($(this).attr('title') || '').toLowerCase();
    return typeof text === 'string' && name.indexOf(text) < 0 && description.indexOf(text) < 0;
  };

  var filterPanelGroup = function(text) {
    var panelGroup = $(this);
    // Filter the sections.
    panelGroup.find('.list-group-item').each(function() {
      $(this).toggleClass('hidden', filterItem.call(this, text));
    });
    // Filter the categories.
    panelGroup.find('a.panel-heading').each(function() {
      var panel = $(this).closest('.panel');
      var hasVisibleSections = panel.find('.list-group-item').not('.hidden').length > 0;
      var matchesFilterQuery = !filterItem.call($(this), text);
      panel.toggle(hasVisibleSections || matchesFilterQuery);
      if (!hasVisibleSections && matchesFilterQuery) {
        // If the filter query matches only the category name/description and none of its sections name/description then
        // show all the sections.
        panel.find('.list-group-item').removeClass('hidden');
      }
      // Fix the style (round corners) of the last visible section in each category.
      panel.find('.list-group-item.last').removeClass('last');
      panel.find('.list-group-item').not('.hidden').last().addClass('last');
    });
    // Expand the first visible category, if there is a filter query.
    if (typeof text === 'string' && text !== '') {
      // We expand the category manually, instead of using the JavaScript API of Bootstrap Collapse, because we can't
      // disable the animation.
      panelGroup.find('.panel-collapse.in').removeClass('in')
        .prev('.panel-heading').addClass('collapsed').attr('aria-expanded', false);
      panelGroup.find('a.panel-heading').filter(':visible').first()
        .removeClass('collapsed').attr('aria-expanded', true)
        // Remove the height:0px in-line style added by the collapse animation because it breaks the border styles.
        .next('.panel-collapse').addClass('in').css('height', '');
    }
    // Show/Hide the "No results." message.
    var hasVisibleCategories = panelGroup.find('a.panel-heading').filter(':visible').length > 0;
    panelGroup.find('.noitems').toggleClass('hidden', hasVisibleCategories);
  };

  var timeoutId;
  $('.panel-group-filter').on('input', function() {
    // Cancel the previously scheduled filter operation.
    clearTimeout(timeoutId);
    var panelGroup = $(this).closest('.panel-group');
    var text = $(this).val().toLowerCase();
    // Schedule a new filter operation.
    timeoutId = setTimeout(filterPanelGroup.bind(panelGroup, text), 500);

  // Finally, enable the search input.
  }).prop('disabled', false);
});
