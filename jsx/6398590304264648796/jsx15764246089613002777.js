define('xwiki-ckeditor-inline', ['jquery', 'xwiki-ckeditor'], function($, ckeditorPromise) {
  var loadCSS = function(url) {
    $('<link>').attr({
      type: 'text/css',
      rel: 'stylesheet',
      href: url
    }).appendTo('head');
  };

  var css = [
    // Styles for the editor UI (tool bar, dialogs, etc.).
    new XWiki.Document('EditSheet', 'CKEditor').getURL('ssx'),
    // Custom styles for the edited content.
    new XWiki.Document('ContentSheet', 'CKEditor').getURL('ssx'),
    "..\/..\/webjars\/xwiki-platform-ckeditor-plugins\/16.10.5\/webjar.bundle.min.css",
    "..\/..\/webjars\/xwiki-platform-tree-webjar\/16.10.5\/tree.min.css",
    "..\/..\/webjars\/xwiki-platform-tree-webjar\/16.10.5\/finder.min.css"
  ];
  css.forEach(loadCSS);

  $(document).on('xwiki:actions:edit', function(event, config) {
    if (config && config.contentType === 'org.xwiki.rendering.syntax.SyntaxContent' && config.editMode === 'wysiwyg') {
      var container = $(event.target);
      ckeditorPromise.done(function(ckeditor) {
        createEditors(ckeditor, container, config);
      });
    }
  });

  var startAvoidingCKAndSaveBarOverlap = function(editor) {
    // CKEDITOR-470 - CKEditor's toolbar may overlap with XWiki's save bar.
    // This function is a workaround that checks if they overlap when the page
    // is scrolled and when the CKEditor's toolbar's CSS style is changed
    // Ideally, we would cooperate with CKEditor's code to position its toolbar,
    // but the toolbar position is not customizable.
    //
    // The CKEditor toolbar (the floatSpace variable) is positioned by this code:
    // https://github.com/ckeditor/ckeditor4/blob/19a386c4691a99d37b43e876e5f5a7ce092c6016/plugins/floatingspace/plugin.js#L100
    //
    // This happens when the editor gains focus, when some text is typed (the
    // editor's content changes), when the window is scrolled or when the window
    // is resized.
    // See https://github.com/ckeditor/ckeditor4/blob/19a386c4691a99d37b43e876e5f5a7ce092c6016/plugins/floatingspace/plugin.js#L310

    function avoidCKAndSaveBarOverlap() {
      // This callback will be called when the page is scrolled or when the
      // CKEditor's toolbar position is changed.

      var ckBRC = ckFloatingToolbar.getBoundingClientRect();
      var saveBRC = saveBar.getBoundingClientRect();
      var collision = ckBRC.top + ckBRC.height > saveBRC.top;
      if (saveBar.classList.contains("sticky-buttons-fixed")) {
          // If XWiki's save bar is sticky, it should not have our custom
          // padding-top.
          if (saveBar.style.paddingTop) {
            saveBar.style.paddingTop = '';
          }

          if (collision) {
            // If there is a collision, CKEditor decided to place the toolbar at
            // the bottom. This is the chosen position if:
            // - the height of the CKEditor toolbar is not greater than the top of
            //   the editor relative to the viewport, and
            // - the height of the CKEditor toolbar is not greater than the
            //   difference between the bottom of the editor relative to the
            //   viewport and its height
            // We put the CKEditor toolbar at the top of the viewport.
            // Note that CKEditor will try to revert this on the events
            // previously listed but we will force the position back again
            // immediately thanks to the mutation observer. This does not
            // trigger an event that makes CKEditor position the toolbar once
            // again, so we are not racing with it.

            ckFloatingToolbar.style.position = "fixed";
            ckFloatingToolbar.style.top = "0px";
          }
      } else {
        // If the XWiki's save bar is not sticky, we add a padding-top
        // corresponding to the CKEditor toolbar's height if there is a
        // collision, and we revert to the initial padding-top if there is no
        // collision.
        if (collision) {
          if (!saveBar.style.paddingTop) {
            saveBar.style.paddingTop = (parseInt(getComputedStyle(saveBar).getPropertyValue('padding-top')) + ckBRC.height) + 'px';
          }
        } else {
          if (saveBar.style.paddingTop) {
            saveBar.style.paddingTop = '';
          }
        }
      }
    }

    var ckFloatingToolbar = document.getElementById('cke_' + editor.name);
    var saveBar = document.getElementsByClassName('inplace-editing-buttons')[0];
    if (ckFloatingToolbar && saveBar) {
      window.addEventListener("scroll", avoidCKAndSaveBarOverlap);
      var mutationObserver = new MutationObserver(avoidCKAndSaveBarOverlap);
      mutationObserver.observe(ckFloatingToolbar, {
        attributes: true,
        attributeFilter: ['style']
      });

      return function stopAvoidingCKAndSaveBarOverlap() {
        window.removeEventListener("scroll", avoidCKAndSaveBarOverlap);
        mutationObserver.disconnect();
      };
    }

    return null;
  };

  var createEditors = function(ckeditor, container, config) {
    if (config.editorName) {
      // We cannot set the editor name through the editor configuration. The editor name is taken by default from the
      // container id or name. To overcome this we set the editor name just after the editor instance is created.
      const handler = ckeditor.on('instanceCreated', event => {
        if (event.editor.element.$ === container[0]) {
          event.editor.name = config.editorName;
          handler.removeListener();
        }
      });
    }

    container.attr({
      'data-sourceDocumentReference': XWiki.Model.serialize(config.document.documentReference),
      'data-syntax': config.document.syntax
    }).each(function() {
      try {
        createEditor(ckeditor, this, config).done(config.deferred.resolve.bind(config.deferred, config.document));
      } catch (e) {
        console.log(e);
        new XWiki.widgets.Notification("Не удалось инициализировать CKEditor.", 'error');
        config.deferred.reject();
      }
    });
  };

  var createEditor = function(ckeditor, element, config, instanceConfig) {
    var stopAvoidingCKAndSaveBarOverlap = null;
    var deferred = $.Deferred();
    var editor = ckeditor.inline(element, $.extend({
      // It doesn't make sense to resize the editor when editing in-line and it also creates problems with the way
      // we implemented the maximize feature for the in-line editor.
      resize_enabled: false
    }, instanceConfig));
    // Disable the source mode if the in-place editor doesn't support it, i.e. XWiki [12.3RC1, 12.4].
    if (!config.enableSourceMode) {
      editor.once('configLoaded', function(event) {
        if (typeof editor.config.removePlugins === 'string') {
          editor.config.removePlugins += ',xwiki-source,xwiki-sourcearea';
        }
      });
    }
    editor.once('instanceReady', function() {
      deferred.resolve(editor);
      // Make the content editable after the editor is ready and visible.
      // See CKEDITOR-390: The inline editor loads as read-only in Safari
      editor.setReadOnly(false);
      stopAvoidingCKAndSaveBarOverlap = startAvoidingCKAndSaveBarOverlap(editor);
    });
    editor.once('reload', function(event) {
      $(document).off(['xwiki:actions:view.contentEditor', 'xwiki:actions:beforeSave.contentEditor'].join(' '));
      event.data.promise = event.data.promise.then(createEditor.bind(null, ckeditor, element, config));
    });
    $(document).on('xwiki:actions:beforeSave.contentEditor', function(event) {
      config.document[editor.mode === 'source' ? 'content' : 'renderedContent'] = editor.getData();
      // Delete the document content field that is not used so that the in-place editor knows what to submit on save.
      delete config.document[editor.mode === 'source' ? 'renderedContent' : 'content'];
      config.document.syntax = editor.config.sourceSyntax;
    });
    $(document).one('xwiki:actions:view.contentEditor', function(event, data) {
      $(document).off('xwiki:actions:beforeSave.contentEditor');
      // Blur the edited content to re-enable the "disabled in inputs" shortcut keys (e.g. the page edit shortcut).
      // We also do this because destroying the editor while the edited content has the focus can lead to an error.
      // See below.
      $(element).blur().prop('contenteditable', false).removeAttr('contenteditable');
      // We destroy the editor after the edited content has lost the focus completely because the editor has a
      // delayed event listener that tries to access the selection even after the editor has been destroyed.
      setTimeout(function() {
        // Don't update the edited element with the data from the editor because:
        // * the editor data might be wiki syntax if the current mode is Source
        // * the in-place editor updates the edited element anyway using the view HTML (without rendering markers)
        //   and we risk overwriting it.
        editor.destroy(/* noUpdate: */ true);
        if (stopAvoidingCKAndSaveBarOverlap) {
          stopAvoidingCKAndSaveBarOverlap();
          stopAvoidingCKAndSaveBarOverlap = null;
        }
      }, 0);
    });
    return deferred.promise();
  };
});
