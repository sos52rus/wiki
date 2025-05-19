'use strict';require(["xwiki-tree"],function(a){var e=function(f,b){a(b&&b.elements||document).find(".xtree").xtree().one("ready.jstree",function(c,d){(c=d.instance.element.attr("data-openTo"))&&d.instance.openTo(c)})};a(e).on("xwiki:dom:updated",e)});
//# sourceMappingURL=tree.min.js.map
