define('NumberedHeadingsConfigLocalization', {
  prefix: 'numbered.headings.',
  keys: [
    'ckeditor.headerConfigurationAction.title',
    'ckeditor.headerConfigurationAction.start.title',
    'ckeditor.headerConfigurationAction.start.title.error.invalidNumber',
    'ckeditor.skipNumberingHeader.activate.title',
    'ckeditor.skipNumberingHeader.deactivate.title'
  ]
});

define('NumberedHeadingsConfig', () => {
  const numberedHeadingsConfig = JSON.parse(document.getElementById('numbered-headings-config').textContent);
  var isActivated = undefined;
  return {
    isActivated() {
      if (isActivated !== undefined) {
        return isActivated;
      }
      return numberedHeadingsConfig.isActivated;
    },
    updateActivationStatus(status) {
      if (status != this.isActivated()) {
        var contentElement = document.getElementById("xwikicontent");
        if (contentElement) {
          if (status) {
            contentElement.classList.remove("disable-numbered-headings");
            if (!numberedHeadingsConfig.isActivated) {
              contentElement.classList.add("numbered-content-root");
            }
          } else {
            contentElement.classList.remove("numbered-content-root");
            if (numberedHeadingsConfig.isActivated) {
              contentElement.classList.add("disable-numbered-headings");
            }
          }
        }
      }
      isActivated = status;
    },
    isActivatedOnParent() {
      return numberedHeadingsConfig.isActivatedOnParent;
    }
  }
})
require(
  ['jquery', 'deferred!ckeditor', 'NumberedHeadingsConfig', 'xwiki-l10n!NumberedHeadingsConfigLocalization'],
  function ($, ckeditorPromise, config, l10n) {

    function activatedByClass(editor) {
      let selection = editor.getSelection();
      if(!selection) {
        return false;
      }
      let ascendant = selection.getStartElement()
        .getAscendant(element => {
          if (!element.getAttribute) {
            return false;
          }
          let attribute = element.getAttribute("class");
          let split = attribute?.split(' ');
          return split?.includes('numbered-content-root')
        }, true);
      return ascendant !== null;
    }

    function activated(editor) {
      return config.isActivated() || activatedByClass(editor);
    }

    ckeditorPromise.done(ckeditor => {
      if (!('xwiki-numberedHeadings' in ckeditor.plugins.registered)) {
        ckeditor.plugins.add('xwiki-numberedHeadings', {
          requires: 'dialog',
          init: function (editor) {
            handleIndentation(editor);
            handleHeaderRightClick(editor);
          }
        });

        ckeditor.on('instanceCreated', event => {
          if (event.editor.config.extraPlugins === '') {
            event.editor.config.extraPlugins = 'xwiki-numberedHeadings';
          } else {
            event.editor.config.extraPlugins += ',xwiki-numberedHeadings';
          }
        });
      }

      //
      // Indentation specific code.
      //
      const handleIndentation = function (editor) {
        ckeditor.plugins.indent.registerCommands(editor, {
          indentHeading: new CommandDefinition(editor, 'indentHeading', true),
          outdentHeading: new CommandDefinition(editor, 'outdentHeading')
        });
      };

      function CommandDefinition(editor) {
        ckeditor.plugins.indent.specificDefinition.apply(this, arguments);
        this.requiredContent = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

        editor.on('key', function (event) {
          if (activated(editor)) {
            const path = editor.elementPath();
            if (path && editor.mode === 'wysiwyg' && event.data.keyCode === this.indentKey) {
              const heading = this.getContext(path);
              if (heading && !(this.isIndent && heading.is('h6'))) {
                editor.execCommand(this.relatedGlobal);
                // Cancel the key event so editor doesn't lose focus.
                event.cancel();
              }
            }
          }
        }, this);

        // There are two different jobs for this plugin:
        //
        //	* Indent job (priority=10), before indentblock.
        //
        //	  This job is before indentblock because, if this plugin is loaded it has higher priority over indentblock.
        //
        //	* Outdent job (priority=30), after outdentblock.
        //
        //	  This job got to be after outdentblock because in some cases outdent must be done on block-level.

        this.jobs[this.isIndent ? 10 : 30] = {
          refresh: function (editor, path) {
            const heading = this.getContext(path);
            if (!heading || (this.isIndent && heading.is('h6'))) {
              return ckeditor.TRISTATE_DISABLED;
            } else {
              return ckeditor.TRISTATE_OFF;
            }
          },
          exec: ckeditor.tools.bind(indentHeading, this)
        };
      }

      ckeditor.tools.extend(CommandDefinition.prototype, ckeditor.plugins.indent.specificDefinition.prototype, {
        context: {h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1}
      });

      const indentHeading = function (editor) {
        const selection = editor.getSelection();
        if (selection && selection.isCollapsed()) {
          const heading = selection.getStartElement().getAscendant(element => this.context[element.getName()], true);
          var level = parseInt(heading.getName().substring(1));
          level += this.isIndent ? 1 : -1;
          if (level < 1) {
            heading.renameNode('p');
          } else if (level <= 6) {
            heading.renameNode('h' + level);
          }
        }
      };
    });

    //
    // Right-click specific code.
    //
    function handleHeaderRightClick(editor) {
      /**
       * Activate the action only when the condition is reached (ie, click on a hX header).
       *
       * @param def the command definition
       */
      function createDef(def) {
        return CKEDITOR.tools.extend(def || {}, {
          contextSensitive: 1,
          refresh: function (editor, path) {
            const isHeader = activated(editor) && (
              path.contains('h1', 1)
              || path.contains('h2', 1)
              || path.contains('h3', 1)
              || path.contains('h4', 1)
              || path.contains('h5', 1)
              || path.contains('h6', 1));
            this.setState(isHeader ? CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_DISABLED);
          }
        });
      }

      /**
       * Activate the action only when the condition is reached (ie, click on a hX header).
       *
       * @param def the command definition
       * @param activatedStatus when true, expect the right-clicked element to have the skip attribute, otherwise,
       *   expect it not have the skip attribute
       */
      function createDefSkip(def, activatedStatus) {
        return CKEDITOR.tools.extend(def || {}, {
          contextSensitive: 1,
          refresh: function (editor, path) {
            let headerNode = path.contains('h1', 1)
              || path.contains('h2', 1)
              || path.contains('h3', 1)
              || path.contains('h4', 1)
              || path.contains('h5', 1)
              || path.contains('h6', 1);
            const isHeader = activated(editor) && headerNode;
            const isSkippedHeader = isHeader && headerNode.$.attributes["data-xwiki-rendering-protected"] !== undefined;
            this.setState(isHeader && isSkippedHeader === activatedStatus ? CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_DISABLED);
          }
        });
      }


      function getHeadingElement(editor) {
        var range;
        try {
          range = editor.getSelection().getRanges()[0];
        } catch (e) {
          return null;
        }

        range.shrink(CKEDITOR.SHRINK_TEXT);
        let ancestors = editor.elementPath(range.getCommonAncestor());
        return ancestors.contains('h1', 1)
          || ancestors.contains('h2', 1)
          || ancestors.contains('h3', 1)
          || ancestors.contains('h4', 1)
          || ancestors.contains('h5', 1)
          || ancestors.contains('h6', 1);
      }

      CKEDITOR.dialog.add('headerConfig', () => {
        return {
          title: l10n['ckeditor.headerConfigurationAction.title'],
          minHeight: 50,
          minWidth: 150,
          resizable: CKEDITOR.DIALOG_RESIZE_NONE,
          getModel: () => {
            return getHeadingElement(editor);
          },
          contents: [{
            id: 'start',
            label: 'Start',
            elements: [{
              id: 'startValue',
              label: l10n['ckeditor.headerConfigurationAction.start.title'],
              type: 'text',
              default: '',
              validate: CKEDITOR.dialog.validate.integer(
                l10n['ckeditor.headerConfigurationAction.start.title.error.invalidNumber']),
              setup: function (element) {
                const value = parseInt(element.$.style.getPropertyValue("--numbered-headings-start"), 10) + 1 || '';
                this.setValue(value);
              },
              commit: function (element) {
                const value = this.getValue().trim();
                if (value !== '') {
                  const parsedValue = parseInt(value, 10);
                  element.setAttribute("data-numbered-headings-start", parsedValue);
                  element.$.style.setProperty("--numbered-headings-start", parsedValue - 1);
                } else {
                  element.removeAttribute("data-numbered-headings-start");
                  element.$.style.removeProperty("--numbered-headings-start");
                }
              },
            }]
          }],
          onShow: function () {
            const editor = this.getParentEditor(),
              element = getHeadingElement(editor, 'ul');

            element && this.setupContent(element);
          },
          onOk: function () {
            const editor = this.getParentEditor(),
              element = getHeadingElement(editor, 'ul');

            element && this.commitContent(element);
          }
        }
      })

      editor.addCommand('headerConfigCmd', new CKEDITOR.dialogCommand('headerConfig', createDef({
        requiredContent: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      })));

      editor.addCommand('activateSkipNumberingCmd', createDefSkip({
        exec: function (editor) {
          getHeadingElement(editor).$.setAttribute("data-xwiki-rendering-protected", "true");
        }
      }, false));

      editor.addCommand('deactivateSkipNumberingCmd', createDefSkip({
        exec: function (editor) {
          getHeadingElement(editor).$.removeAttribute("data-xwiki-rendering-protected")
        }
      }, true));

      // If the "menu" plugin is loaded, register the menu item.
      if (editor.addMenuItems) {
        editor.addMenuItem('headerConfig', {
          label: l10n['ckeditor.headerConfigurationAction.title'],
          command: 'headerConfigCmd',
          group: 'clipboard',
          order: 12
        });
        editor.addMenuItem('activateSkipNumbering', {
          label: l10n['ckeditor.skipNumberingHeader.activate.title'],
          command: 'activateSkipNumberingCmd',
          group: 'clipboard',
          order: 13
        });
        editor.addMenuItem('deactivateSkipNumbering', {
          label: l10n['ckeditor.skipNumberingHeader.deactivate.title'],
          command: 'deactivateSkipNumberingCmd',
          group: 'clipboard',
          order: 14
        });
      }

      if (editor.contextMenu) {
        editor.contextMenu.addListener(function () {
          return {
            headerConfig: CKEDITOR.TRISTATE_ON,
            activateSkipNumbering: CKEDITOR.TRISTATE_ON,
            deactivateSkipNumbering: CKEDITOR.TRISTATE_ON,
          }
        })
      }
    }
  }
)

