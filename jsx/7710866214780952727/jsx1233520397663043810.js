document.observe("xwiki:dom:loaded", function(){
   $('xwikicontent').select("div.spoiler div.spoilerTitle")
                       .invoke("observe", "click", function(event){
                           event.element().up("div.spoiler").down("div.spoilerContent").toggleClassName("hidden");
                        });
});
