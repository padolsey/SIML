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
				console.warn('Unknown pseudo class used:', name)
			}
		}
	}

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

		this.tag = null;
		this.id = null;
		this.attrs = [];
		this.classes = [];
		this.pseudos = [];

		this.isSingular = false;
		this.multiplier = 1;

		this.isPretty = config.pretty;

		this.htmlOutput = [];
		this.htmlContent = [];
		this.htmlAttributes = [];

		this.selector = spec[0];
		this.children = spec[1] || [];

		this.make();
		this.processChildren();
		this.collectOutput();

		this.html = this.htmlOutput.join('');

	}

	Element.prototype = {

		make: function() {

			var selector = this.selector;
			var selectorPortionType;
			var selectorPortion;

			for (var i = 0, l = selector.length; i < l; ++i) {
				selectorPortionType = selector[i][0];
				selectorPortion = selector[i][1];
				switch (selectorPortionType) {
					case 'Tag':
						this.tag = selectorPortion; break;
					case 'Id':
						this.id = selectorPortion; break;
					case 'Attr':
						this.attrs.push(selectorPortion); break;
					case 'Class':
						this.classes.push(selectorPortion); break;
					case 'Pseudo':
						this.pseudos.push(selectorPortion); break;
				}
			}

			this.tag = this.config.toTag.call(this, this.tag || DEFAULT_TAG);
			this.isSingular = this.tag in SINGULAR_TAGS;

			if (this.id) {
				this.htmlAttributes.push(
					'id="' + this.id + '"'
				);
			}

			if (this.classes.length) {
				this.htmlAttributes.push(
					'class="' + this.classes.join(' ').replace(/(^| )\./g,	'$1') + '"'
				);
			}

			for (var i = 0, l = this.attrs.length; i < l; ++ i) {
				this.processProperty('Attribute', this.attrs[i]);
			}

			for (var i = 0, l = this.pseudos.length; i < l; ++ i) {
				var p = this.pseudos[i];
				if (!isNaN(p[0])) {
					this.multiplier = p[0];
					continue;
				}
				this.processProperty('Pseudo', p);
			}

		},

		collectOutput: function() {

			var indent = this.indentation;
			var isPretty = this.isPretty;
			var output = this.htmlOutput;
			var attrs = this.htmlAttributes;
			var content = this.htmlContent;

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

			if (this.multiplier > 1) {
				var all = output.join('');
				for (var m = this.multiplier - 1; m--;) {
					output.push(isPretty ? '\n' : '');
					output.push(all);
				}
			}

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
			this.htmlContent.push(
				new Parser.Element(
					[selector, children],
					this.config,
					this,
					this.indentation + this.defaultIndentation
				).html
			);
		},
		processProperty: function(type, args) {
			// type = Attribute | Directive | Pseudo
			var property = new Parser[type](
				args,
				this.config,
				this,
				this.indentation + this.defaultIndentation
			);
			if (property.html) {
				switch (property.type) {
					case 'ATTR':
						this.htmlAttributes.push(property.html);
						break;
					case 'CONTENT':
						this.htmlContent.push(this.indentation + this.defaultIndentation + property.html);
						break;
				}
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
	Parser.Pseudo = ConfigurablePropertyFactory('pseudos', DEFAULT_PSEUDOS);

	Parser.prototype = {

		defaultConfig: {
			pretty: true,
			curly: false,
			codeMatcher: null, // String (not RegExp) e.g. '<%.+?%>'
			indent: DEFAULT_INDENTATION,
			directives: {},
			attributes: {},
			pseudos: {},
			toTag: function(t) {
				return t;
			}
		},

		parse: function(spec, singleRunConfig) {

			singleRunConfig = defaults(this.config, singleRunConfig || {});

			if (!singleRunConfig.pretty) {
				singleRunConfig.indent = '';
			}

			if (singleRunConfig.curly) {
				spec += '\n/*siml:curly=true*/';
			}

			if (singleRunConfig.codeMatcher) {

				if (!singleRunConfig.curly) {
				//	throw new Error('SIML: Template-logic code matching (using codeMatcher) cannot occur unless config:curly is true');
				}

				spec = this._tokenizeCode(spec, singleRunConfig.codeMatcher);
			}

			try {
				spec = siml.PARSER.parse(spec);
			} catch(e) {
				if (e.line !== undefined && e.column !== undefined) {
					throw new SyntaxError('SIML: Line ' + e.line + ', column ' + e.column + ': ' + e.message);
				} else {
					throw new SyntaxError('SIML: ' + e.message);
				}
			}

			var html = [];

			for (var i = 0, l = spec.length; i < l; ++i) {
				var type = spec[i][0];
				html[i] = new Parser[type](
					spec[i][1],
					singleRunConfig
				).html;
			}

			return this._deTokenizeCode(
				html.join(singleRunConfig.pretty ? '\n' : '')
			);
		},

		_tokenizeCode: function(input, matcher) {
			var codeTokens = this._codeTokens = [];
			return input.replace(RegExp(matcher, 'g'), function($0) {
				return '"____CODE_TOKEN_____' + (codeTokens.push($0) - 1) + '"';
			});
		},

		_deTokenizeCode: function(input) {
			if (!this._codeTokens) {
				return input; // Code has not been tokenized.
			}
			var codeTokens = this._codeTokens;
			return input.replace(/____CODE_TOKEN_____(\d+)/g, function(_, d) {
				return codeTokens[d];
			});
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
