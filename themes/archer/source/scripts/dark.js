(()=>{var e,r=$(".header-theme-btn"),a=function(e){e?r.removeClass("header-theme-btn-disabled"):r.addClass("header-theme-btn-disabled")},t=function(e){a(!1);var r=$("LINK[href='".concat(e,"css/dark.css']"));1===r.length?(r.remove(),localStorage.preferredThemeMode="light"):($("<link>").attr({rel:"stylesheet",type:"text/css",href:"".concat(e,"css/dark.css")}).appendTo("head"),localStorage.preferredThemeMode="dark"),a(!0)};a(!1),"light"===((e=localStorage.preferredThemeMode)?e="dark"===e?"dark":"light":(e=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",localStorage.preferredThemeMode=e),e)&&t(window.siteMeta.root),r.click((function(){t(window.siteMeta.root)})),a(!0)})();
//# sourceMappingURL=dark.js.map