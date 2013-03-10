(function() {

	var HTML_TAGS = [
		'a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base',
		'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blink', 'blockquote', 'body', 'br', 'button',
		'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'command', 'data', 'datalist',
		'dd', 'del', 'details', 'dfn', 'dir', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption',
		'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'isindex',
		'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'listing', 'main', 'map', 'mark', 'marquee',
		'menu', 'meta', 'meter', 'nav', 'nobr', 'noframes', 'noscript', 'object', 'ol', 'optgroup',
		'option', 'output', 'p', 'param', 'plaintext', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's',
		'samp', 'script', 'section', 'select', 'small', 'source', 'spacer', 'span', 'strike', 'strong',
		'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time',
		'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr', 'xmp'
	];

	var INPUT_TYPES = {
		button: 1, checkbox: 1, color: 1, date: 1, datetime: 1, 'datetime-local': 1,
		email: 1, file: 1, hidden: 1, image: 1, month: 1, number: 1, password: 1, radio: 1,
		range: 1, reset: 1, search: 1, submit: 1, tel: 1, text: 1, time: 1, url: 1, week: 1
	};

	var HTML_SHORT_MAP = {};

	HTML_TAGS.forEach(function(tag) {
		// Without vowels
		HTML_SHORT_MAP[ tag ] = tag;
		if (tag.length > 2) { // TODO: DO MANUAL
			var vowelless = tag.replace(/[aeiou]+/g, '');
			if (vowelless.length > 1 && !HTML_SHORT_MAP[vowelless]) {
				HTML_SHORT_MAP[vowelless] = tag;
			}
		}
	});

	var doctypeDirective = {
		type: 'CONTENT',
		make: function() {
			return '<!doctype html>'
		}
	};

	siml.html5 = new siml.Parser({
		pretty: true,
		indent: '	',
		toTag: function(tag) {
			return HTML_SHORT_MAP[ tag ] || tag;
		},
		directives: {
			doctype: doctypeDirective,
			dt: doctypeDirective
		},
		pseudos: {
			_default: {
				type: 'ATTR',
				make: function(name) {
					if (this.parentElement.tag === 'input' && name in INPUT_TYPES) {
						return 'type="' + name + '"';
					}
					throw new Error('Unknown Pseduo: ' + name);
				}
			}
		}
	});

	siml.html5.HTML_SHORT_MAP = HTML_SHORT_MAP;
	siml.html5.INPUT_TYPES = INPUT_TYPES;

}());

