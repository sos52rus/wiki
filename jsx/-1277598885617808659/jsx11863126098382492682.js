XWiki.locale = document.documentElement.getAttribute('lang') || '';

require.config({
  config: {
    l10n: {
      // We need to specify the language because this URL can be used after the page is loaded and thus after the
      // context language changes on the server session (e.g. if the user opens another page in another browser tab with
      // a different language specified). We take the current language from the page HTML, rather than using Velocity,
      // in order to avoid having the current language cached.
      url: new XWiki.Document('Translator', 'CKEditor').getURL('get', 'outputSyntax=plain&language=' +
        encodeURIComponent(XWiki.locale))
    }
  }
});

define('xwiki-ckeditor', [
  'jquery',
  // The CKEditor standard API.
  'ckeditor',
  // Used to access the form token required by the upload URL.
  'xwiki-meta',
  // CKEditor plugins specific to XWiki.
  'xwiki-ckeditor-plugins',
  // Used to catch form action events fired from Prototype.js code (actionButtons.js).
  'xwiki-events-bridge',
  // Load the translations for our custom CKEditor plugins.
  new XWiki.Document('Translations', 'CKEditor').getURL('jsx', 'language=' + encodeURIComponent(XWiki.locale))
], function($, ckeditor, xwikiMeta) {
  // We have to pass the plugin that makes the request (the initiator) because the expected response can be different
  // (e.g. between the filebrowser and filetools plugins).
  var getUploadURL = function(document, initiator) {
    return document.getURL('get', $.param({
      sheet: 'CKEditor.FileUploader',
      outputSyntax: 'plain',
      // The syntax and language are important especially when the upload request creates a new document.
      syntax: document.syntax,
      language: XWiki.locale,
      form_token: xwikiMeta.form_token,
      initiator: initiator
    }));
  };

  // Extend the default CKEditor configuration with settings that depend on the source document.
  var getConfig = function(element) {
    var sourceSyntax = $(element).attr('data-syntax');
    var sourceDocument = XWiki.currentDocument;
    sourceDocument.syntax = XWiki.docsyntax;
    var sourceDocumentReference = XWiki.Model.resolve($(element).attr('data-sourceDocumentReference'),
      XWiki.EntityType.DOCUMENT, XWiki.currentDocument.documentReference);
    if (!XWiki.currentDocument.documentReference.equals(sourceDocumentReference)) {
      sourceDocument = new XWiki.Document(sourceDocumentReference);
      // We assume the syntax of the source document is the same as the syntax of the edited content.
      sourceDocument.syntax = sourceSyntax;
    }

    var uploadDisabled = element.hasAttribute('data-upload-disabled');
    var startupFocus = element.hasAttribute('data-startup-focus');

    var config = {
      filebrowserUploadUrl: uploadDisabled ? '' : getUploadURL(sourceDocument, 'filebrowser'),
      startupFocus,
      height: $(element).height(),
      // Used to resolve and serialize relative references. Also used to make HTTP requests with the right context.
      sourceDocument: sourceDocument,
      // The syntax of the edited content is not always the same as the syntax of the source document (which applies to
      // the source document content, but we might be editing something else, like an object property).
      sourceSyntax: sourceSyntax,
      uploadUrl: uploadDisabled ? '' : getUploadURL(sourceDocument, 'filetools'),
      'xwiki-link': {
        // We use the source document to compute the link label generator URL because we want the link references to be
        // resolved relative to the edited document (as they were inserted).
        labelGenerator: sourceDocument.getURL('get', $.param({
          sheet: 'CKEditor.LinkLabelGenerator',
          outputSyntax: 'plain',
          language: XWiki.locale
        }))
      }
    };
    return config;
  };

  var oldReplace = ckeditor.replace;
  ckeditor.replace = function(element, config) {
    // Take into account the configuration options specified on the target element.
    return oldReplace.call(this, element, ckeditor.tools.extend(getConfig(element), config, true));
  };

  var oldInline = ckeditor.inline;
  ckeditor.inline = function(element, config) {
    // Take into account the configuration options specified on the target element.
    return oldInline.call(this, element, ckeditor.tools.extend(getConfig(element), config, true));
  };

  //
  // Overwrite in order to add support for configuration namespaces.
  //
  ckeditor.tools.extend = function(target) {
    var argsLength = arguments.length, overwrite, propertiesList;
    if (typeof (overwrite = arguments[argsLength - 1]) === 'boolean') {
      argsLength--;
    } else if (typeof (overwrite = arguments[argsLength - 2]) === 'boolean') {
      propertiesList = arguments[argsLength - 1];
      argsLength -= 2;
    }
    for (var i = 1; i < argsLength; i++) {
      var source = arguments[i] || {};
      ckeditor.tools.array.forEach(ckeditor.tools.object.keys(source), function(propertyName) {
        // Only copy existing fields if in overwrite mode.
        if (overwrite === true || target[propertyName] == null) {
          // Only copy specified fields if list is provided.
          if (!propertiesList || (propertyName in propertiesList)) {
            // NOTE: This is the only part we overwrite.
            setObjectProperty(target, propertyName, source[propertyName]);
          }
        }
      });
    }
    return target;
  };

  var setObjectProperty = function(object, key, value) {
    var oldValue = object[key];
    var newValue = value;
    // Merge the old value with the new value if both are objects and the old value is a configuration namespace.
    if ($.isPlainObject(oldValue) && oldValue.__namespace === true && $.isPlainObject(newValue)) {
      // We don't modify directly the old value because it may be inherited (e.g. global configuration).
      newValue = ckeditor.tools.extend({}, oldValue, newValue, true);
    }
    object[key] = newValue;
  };

  // See XWIKI-21351: Macros using RequireJS are not properly displayed by the standalone WYSIWYG editor even when
  // JavaScript is enabled.
  //
  // For each CKEditor instance that uses a separate DOM document for the edited content (i.e. classical iframe-based
  // editor) we overwrite the appendChild and insertBefore functions of the initial HEAD element in order to make sure
  // that RequireJS appends the script tags to the current HEAD element (because the HEAD element is overwritten each
  // time the edited content is reloaded, like when inserting a macro or switching between Source and WYSIWYG modes).
  //
  // We have to overwrite both appendChild and insertBefore because depending on the presence of the BASE element
  // RequireJS uses one or the other.
  ckeditor.on('instanceReady', ({editor}) => {
    if (editor.document.$ !== document) {
      // This editor instance is using a separate DOM document for editing which means it's a standalone editor.
      const initialHead = editor.document.$.head;
      const originalAppendChild = initialHead.appendChild;
      initialHead.appendChild = function() {
        const currentHead = editor.document.$.head;
        if (currentHead !== initialHead) {
          // The edited content has been reloaded. Append to the current HEAD.
          return currentHead.appendChild.apply(currentHead, arguments);
        } else {
          // Still using the initial HEAD so preserve the default behavior.
          originalAppendChild.apply(initialHead, arguments);
        }
      };
      const originalInsertBefore = initialHead.insertBefore;
      initialHead.insertBefore = function(newChild, existingChild) {
        const currentHead = editor.document.$.head;
        if (currentHead !== initialHead) {
          // The edited content has been reloaded. Normally the given existingChild should be a child of the initial
          // HEAD element (not the current one), but better check to be sure.
          if (existingChild.parentNode === currentHead) {
            return currentHead.insertBefore(newChild, existingChild);
          } else {
            return currentHead.appendChild.apply(newChild);
          }
        } else {
          // Still using the initial HEAD so preserve the default behavior.
          return originalInsertBefore.apply(initialHead, arguments);
        }
      };
    }
  });

  return $.Deferred().resolve(ckeditor).promise();
});
require(['jquery', 'xwiki-ckeditor', 'xwiki-events-bridge'], function($, ckeditorPromise) {
  // Make sure we don't create the editors twice because this file can be loaded twice (by RequireJS, for in-place
  // editing, and as a JSX resource, for standalone editing).
  if (ckeditorPromise.__editSheetLoaded) {
    return;
  }
  ckeditorPromise.__editSheetLoaded = true;

  var createEditors = function(ckeditor, container) {
    container.find('.ckeditor-textarea').each(function() {
      // Wrap in try/catch so that a failure to load one editor doesn't affect the other editors.
      try {
        createEditor(ckeditor, this);
      } catch(e) {
        console.log(e);
      }
    });
  };

  var createEditor = function(ckeditor, textArea, instanceConfig) {
    var deferred = $.Deferred();
    var editor = ckeditor.replace(textArea, instanceConfig);
    editor.once('instanceReady', deferred.resolve.bind(deferred, editor));
    editor.once('reload', function(event) {
      event.data.promise = event.data.promise.then(createEditor.bind(null, ckeditor, textArea));
    });
    return deferred.promise();
  };

  ckeditorPromise.done(function(ckeditor) {
    createEditors(ckeditor, $(body));
    // Make sure we don't register the event listener multiple times (in case this code is loaded multiple times).
    $(document).off('xwiki:dom:updated.ckeditor').on('xwiki:dom:updated.ckeditor', function(event, data) {
      createEditors(ckeditor, $(data.elements));
    });
  });
});
