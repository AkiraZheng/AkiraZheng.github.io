'use strict';

const deflate = require('./deflate');

const encode64 = function(data) {
    let r = "";
    for (let i = 0; i < data.length; i += 3) {
        if (i + 2 == data.length) {
            r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), 0);
        } else if (i + 1 == data.length) {
            r += append3bytes(data.charCodeAt(i), 0, 0);
        } else {
            r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), data.charCodeAt(i + 2));
        }
    }
    return r;
};

const append3bytes = function(b1, b2, b3) {
    let c1 = b1 >> 2;
    let c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
    let c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
    let c4 = b3 & 0x3F;
    let r = "";
    r += encode6bit(c1 & 0x3F);
    r += encode6bit(c2 & 0x3F);
    r += encode6bit(c3 & 0x3F);
    r += encode6bit(c4 & 0x3F);
    return r;
};

const encode6bit = function(b) {
    if (b < 10) {
        return String.fromCharCode(48 + b);
    }
    b -= 10;
    if (b < 26) {
        return String.fromCharCode(65 + b);
    }
    b -= 26;
    if (b < 26) {
        return String.fromCharCode(97 + b);
    }
    b -= 26;
    if (b == 0) {
        return '-';
    }
    if (b == 1) {
        return '_';
    }
    return '?';
};

const compress = function(s) {
    s = unescape(encodeURIComponent(s));
    return "http://www.plantuml.com/plantuml/svg/" + encode64(deflate.zip_deflate(s, 9));
};

const ignore = data => {
    var source = data.source;
    var ext = source.substring(source.lastIndexOf('.')).toLowerCase();
    return ['.js', '.css', '.html', '.htm'].indexOf(ext) > -1;
};

// Match ```plantuml ... ``` blocks
const reg = /(\s*)(`{3}) *(plantuml) *\n?([\s\S]+?)\s*(\2)(\n+|$)/g;

// Register as before_post_render filter with low priority (runs after mermaid)
hexo.extend.filter.register('before_post_render', function(data) {
    if (!ignore(data)) {
        data.content = data.content
            .replace(reg, function (raw, start, startQuote, lang, content, endQuote, end) {
                const url = compress(content.trim());
                return `${start}<img src="${url}" alt="plantuml diagram">${end}`;
            });
    }
}, 5);