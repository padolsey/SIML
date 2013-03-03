var siml = typeof module != 'undefined' && module.exports ? module.exports : window.siml = {};
(function() {

	'use strict';

	var DEFAULT_TAG = 'div';
	var DEFAULT_INDENTATION = '  ';

	var SINGULAR_TAGS = {
		input: 1, img: 1, meta: 1, link: 1, br: 1, hr: 1,
		source: 1, area: 1, base: 1, col: 1
	};

	var DEFAULT_DIRECTIVES = {
		_fillText: {
			type: 'CONTENT',
			make: function(_, t) {
				return escapeHTML(t);
			}
		},
		_default: {
			type: 'CONTENT',
			make: function(dir) {
				throw new Error('Directive not resolvable: ' + dir);
			}
		}
	};

	var DEFAULT_ATTRIBUTES = {
		_default: {
			type: 'ATTR',
			make: function(attrName, value) {
				return attrName + '="' + escapeHTML(value) + '"';
			}
		},
		text: {
			type: 'CONTENT',
			make: function(_, t) {
				return escapeHTML(t);
			}
		}
	};

	var DEFAULT_PSEUDOS = {
		_default: {
			type: 'ATTR',
			make: function(name) {
				if (this.parentElement.tag === 'input') {
					return 'type="' + name + '"';
				}
				console.warn('Unknown psuedo class used:', name)
			}
		}
	}

	/** 
	 * THESE REGULAR EXPRESSIONS are from the Sizzle CSS Selector Engine
	 *  (c) 2011, The Dojo Foundation
	 */
	var rATTR = /\[\s*((?:[\w\u00c0-\uFFFF\-]|\\.)+)\s*(?:(\S?=)\s*(?:(['"])(.*?)\3|(#?(?:[\w\u00c0-\uFFFF\-]|\\.)*)|)|)\s*\]/g;
	var rID = /#((?:[\w\u00c0-\uFFFF_-]|\\.)+)|$/;
	var rCLASS = /\.((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?![^[\]]+])/g;
	var rTAG = /^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)|$/;
	var rPSEUDO = /:((?:[\w\u00c0-\uFFFF\-]|\\.)+)(?:\((['"]?)((?:\([^\)]+\)|[^\(\)]*)+)\2\))?/g;

	function isArray(a) {
		return {}.toString.call(a) === '[object Array]';
	}
	function escapeHTML(h) {
		return String(h).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
	}
	function trim(s) {
		return String(s).replace(/^\s\s*|\s\s*$/g, '');
	}
	function defaults(defaults, obj) {
		for (var i in defaults) {
			if (!obj.hasOwnProperty(i)) {
				obj[i] = defaults[i];
			}
		}
		return obj;
	}

	function ConfigurablePropertyFactory(methodRepoName, fallbackMethodRepo) {
		return function ConfigurableProperty(args, config, parentElement, indentation) {

			this.parentElement = parentElement;
			this.indentation = indentation;

			args = [].slice.call(args);
			var dName = args[0];

			var propMaker = config[methodRepoName][dName] || fallbackMethodRepo[dName];
			if (!propMaker) {
				propMaker = config[methodRepoName]._default || fallbackMethodRepo._default;
			}

			if  (!propMaker) {
				throw new Error('No fallback for' + args.join(''));
			}

			this.type = propMaker.type;
			this.html = propMaker.make.apply(this, args);

		};
	}

	function Element(spec, config, parentElement, indentation) {

		this.spec = spec;
		this.config = config || {};
		this.parentElement = parentElement || this;
		this.indentation = indentation || '';
		this.defaultIndentation = config.indent;

		this.isPretty = config.pretty;

		this.output = [];
		this.content = [];
		this.attributes = [];

		this.selector = spec[0];
		this.children = spec[1] || [];

		this.make();
		this.processChildren();
		this.collectOutput();

		this.html = this.output.join('');

	}

	Element.prototype = {

		make: function() {

			var selector = this.selector;

			var split = selector.split('>');

			if (split.length > 1) {
				selector = split.shift();
				this.processElement(trim(split.join('>')), this.children);
				this.children = [];
			}

			var tag = selector.match(rTAG)[1] || DEFAULT_TAG;
			var classes = selector.match(rCLASS);
			var id = selector.match(rID)[1];
			var m;

			this.tag = tag;
			this.isSingular = tag in SINGULAR_TAGS;

			if (id) {
				this.attributes.push(
					'id="' + id + '"'
				);
			}

			if (classes) {
				this.attributes.push(
					'class="' + classes.join(' ').replace(/(^| )\./g,	'$1') + '"'
				);
			}

			rATTR.lastIndex = 0;
			rPSEUDO.lastIndex = 0;

			while (m = rATTR.exec(selector)) {
				this.processProperty('Attribute', [m[1], m[5] || m[4]]);
			}

			while (m = rPSEUDO.exec(selector)) {
				this.processProperty('Pseudo', [m[1], m[3]]);
			}

		},

		collectOutput: function() {

			var indent = this.indentation;
			var isPretty = this.isPretty;
			var output = this.output;
			var attrs = this.attributes;
			var content = this.content;

			output.push(indent + '<' + this.tag);
			output.push(attrs.length ? ' ' + attrs.join(' ') : '');

			if (this.isSingular) {
				output.push('/>');
				return;
			}

			output.push('>');

			if (content.length) {
				isPretty && output.push('\n');
				output.push(content.join(isPretty ? '\n': ''));
				isPretty && output.push('\n' + indent);
			}

			output.push('</' + this.tag + '>');

		},

		processChildren: function() {
			var children = this.children;
			for (var i = 0, l = children.length; i < l; ++i) {
				var type = children[i][0];
				if (type === 'Element') {
					this.processElement.apply(this, children[i][1]);
				} else {
					this.processProperty(type, children[i][1]);
				}
			}
		},
		processElement: function(selector, children) {
			this.content.push(
				new Parser.Element(
					[selector, children],
					this.config,
					this,
					this.indentation + this.defaultIndentation
				).html
			);
		},
		processProperty: function(type, args) {
			// type = Attribute | Directive | Psuedo
			var property = new Parser[type](
				args,
				this.config,
				this,
				this.indentation + this.defaultIndentation
			);
			switch (property.type) {
				case 'ATTR':
					this.attributes.push(property.html);
					break;
				case 'CONTENT':
					this.content.push(this.indentation + this.defaultIndentation + property.html);
					break;
			}
		}
	};

	function Parser(parserConfig) {
		this.config = defaults(this.defaultConfig, parserConfig);
	}

	Parser.escapeHTML = escapeHTML;
	Parser.trim = trim;
	Parser.isArray =  isArray;

	Parser.Element = Element;

	Parser.Attribute = ConfigurablePropertyFactory('attributes', DEFAULT_ATTRIBUTES);
	Parser.Directive = ConfigurablePropertyFactory('directives', DEFAULT_DIRECTIVES);
	Parser.Pseudo = ConfigurablePropertyFactory('psuedos', DEFAULT_PSEUDOS);

	Parser.prototype = {

		defaultConfig: {
			pretty: true,
			curly: false,
			indent: DEFAULT_INDENTATION,
			directives: {},
			attributes: {},
			psuedos: {}
		},

		parse: function(spec, singleRunConfig) {

			singleRunConfig = defaults(this.config, singleRunConfig || {});

			if (!singleRunConfig.pretty) {
				singleRunConfig.indent = '';
			}

			if (singleRunConfig.curly) {
				spec += '\n/*siml:curly=true*/';
			}

			try {
				spec = siml.PARSER.parse(spec);
			} catch(e) {
				if (e.line !== undefined && e.column !== undefined) {
					throw new SyntaxError('Siml: Line ' + e.line + ', column ' + e.column + ': ' + e.message);
				} else {
					throw new SyntaxError('Siml: ' + e.message);
				}
			}

			return function() {

				var html = [];

				for (var i = 0, l = spec.length; i < l; ++i) {
					var type = spec[i][0];
					html[i] = new Parser[type](
						spec[i][1],
						singleRunConfig
					).html;
				}

				return html.join(singleRunConfig.pretty ? '\n' : '');
			};
		}

	};

	siml.Parser = Parser;

	siml.defaultParser = new Parser({
		pretty: true,
		indent: DEFAULT_INDENTATION
	});

	siml.parse = function(s, c) {
		return siml.defaultParser.parse(s, c);
	};

}());
