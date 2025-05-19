// Overwrite the Bootstrap Switch in order to customize its behavior.
define('xwiki-bootstrap-switch', ['jquery', 'bootstrap', 'bootstrap-switch'], function($) {
  'use strict';

  // The latest CSS of Bootstrap Switch has this rule:
  //
  //   .bootstrap-switch span::before {
  //     content: "\200b";
  //   }
  //
  // which breaks the font icon we use on the Bootstrap Switch label because by default font icons are rendered using a
  // span, such as:
  //
  //  <span class="fa fa-file-o"></span>
  //
  // and the font icon uses a CSS such as:
  //
  //  .fa-file-o::before {
  //    content: "\f016";
  //  }
  //
  // We can't fix this through CSS so the solution we chose was to replace the "span" tag with another tag like "i"
  // which is often used on the web to display font icons.
  var fixLabel = function(html) {
    if (typeof html !== 'undefined') {
      var container = $('<div/>').html(html);
      // Replace empty "span" that is used to display font icons with "i".
      container.find('span[class]:empty').replaceWith(function() {
        return this.outerHTML.replace(/<(\/?)span/, '<$1i');
      });
      return container.html();
    }
  };

  // Keep a reference to the original Bootstrap Switch function in case someone needs the default behavior.
  $.fn.bootstrapSwitchOrig = $.fn.bootstrapSwitch;
  $.fn.bootstrapSwitch = function(option) {
    if (option === 'labelText' && typeof arguments[1] === 'string') {
      // The caller wants to set the Bootstrap Switch label.
      arguments[1] = fixLabel(arguments[1]);
    } else if (typeof option?.labelText === 'string') {
      // The caller wants to set multiple options, including the label.
      option.labelText = fixLabel(option.labelText);
    }
    return this.bootstrapSwitchOrig.apply(this, arguments);
  };

  // Copy data (such as default configuration, costructor) from the original Bootstrap Switch function.
  $.extend($.fn.bootstrapSwitch, $.fn.bootstrapSwitchOrig);

  [
    // Custom styles for Bootstrap Switch.
    new XWiki.Document(new XWiki.DocumentReference(XWiki.currentWiki, ['XWiki', 'Notifications', 'Code'],
      'BootstrapSwitch')).getURL('ssx')
  ].forEach(function(url) {
    var link = $('<link>').attr({
      type: 'text/css',
      rel: 'stylesheet',
      href: url
    }).appendTo('head');
  });
});
