var siml = typeof module != 'undefined' && module.exports ? module.exports : window.siml = {};
(function() {

	'use strict';

	var push = [].push;

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
				if (!value) {
					return attrName;
				}
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
	function deepCopyArray(arr) {
		var out = [];
		for (var i = 0, l = arr.length; i < l; ++i) {
			if (isArray(arr[i])) {
				out[i] = deepCopyArray(arr[i]);
			} else {
				out[i] = arr[i];
			}
		}
		return out;
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

		this.make();
		this.processChildren(spec[1]);
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

		_handleExcGroup: function(excGroup, specChildren, specChildIndex) {

			this.htmlAttributes = [];
			this.htmlContent = [];
			this.collectOutput = function(){};
			var html = [];
			var tail = excGroup[2];

			attachTail(excGroup, tail); 	

			var exclusives = excGroup[1];

			for (var n = 0, nl = exclusives.length; n < nl; ++n) {
				specChildren[specChildIndex] = exclusives[n];
				var newSpec = [ this.spec[0], this.spec[1].slice() ];
				html.push(
					new (this instanceof RootElement ? RootElement : Element)(
						newSpec,
						this.config,
						this.parentElement,
						this.indentation
					).html
				);
			}

			this.htmlOutput.push( html.join(this.isPretty ? '\n' : '') );

			// attachTail
			// Goes through children (equal candidacy) looking for places to append
			// both the tailChild and tailSelector. Note: they may be placed in diff places
			// as in the case of `(a 'c', b)>d`
			function attachTail(start, tail, hasAttached) {

				var type = start[0];

				var children = getChildren(start);
				var tailChild = tail[0];
				var tailSelector = tail[1];
				var tailChildType = tail[2];

				var hasAttached = hasAttached || {
					child: false,
					selector: false
				};

				if (hasAttached.child && hasAttached.selector) {
					return hasAttached;
				}

				if (children) {
					for (var i = children.length; i-->0;) {
						var child = children[i];

						if (child[0] === 'ExcGroup' && child[2][0]) { // has tailChild
							child = child[2][0];
						}

						if (tailChildType === 'sibling') {
							var cChildren = getChildren(child);
							if (!cChildren || !cChildren.length) {
								// Add tailChild as sibling of child
								children[i] = ['IncGroup', [
									child,
									deepCopyArray(tailChild)
								]];
							hasAttached.child = true; //?
							}
							//break; // TODO
							continue;
						}
						hasAttached = attachTail(child, tail, {
							child: false,
							selector: false
						});
						if (type === 'IncGroup' && hasAttached.child) {
							break;
						}
					}
				}

				if (!hasAttached.selector) {
					if (start[0] === 'Element') {
						if (tailSelector) {
							push.apply(start[1][0], tailSelector);
						}
						hasAttached.selector = true;
					}
				}

				if (!hasAttached.child) {
					if (children) {
						if (tailChild) {
							children.push(deepCopyArray(tailChild));
						}
						hasAttached.child = true;
					}
				}

				return hasAttached;
			}

			function getChildren(child) {
				return child[0] === 'Element' ? child[1][1] :
					child[0] === 'ExcGroup' || child[0] === 'IncGroup' ?
						child[1] : null;
			}
		},

		processChildren: function(children) {

			for (var i = 0, l = children.length; i < l; ++i) {
				var type = children[i][0];
				if (type === 'Element') {
					this.processElement(children[i][1]);
				} else if (type === 'IncGroup') {
					this.processIncGroup(children[i][1]);
				} else if (type === 'ExcGroup') {
					this._handleExcGroup(children[i], children, i);
					return;
				} else {
					this.processProperty(type, children[i][1]);
				}
			}

		},

		processElement: function(spec) {
			this.htmlContent.push(
				new Parser.Element(
					spec,
					this.config,
					this,
					this.indentation + this.defaultIndentation
				).html
			);
		},

		processIncGroup: function(spec) {
			this.processChildren(spec);
		},

		processExcGroup: function(spec) {
			for (var i = 0, l = spec.length; i < l; ++i) {
				var type = children[i][0];
				if (type === 'Element') {
					this.processElement(children[i][1]);
				} else if (type === 'IncGroup') {
					this.processIncGroup(children[i][1]);
				} else {
					this.processProperty(type, children[i][1], 'EXC_TOKEN');
				}
			}
		},

		processProperty: function(type, args, overrideHTML) {
			// type = Attribute | Directive | Pseudo
			var property = new Parser.properties[type](
				args,
				this.config,
				this,
				this.indentation + this.defaultIndentation
			);
			if (property.html) {
				switch (property.type) {
					case 'ATTR':
						this.htmlAttributes.push(overrideHTML || property.html);
						break;
					case 'CONTENT':
						this.htmlContent.push(overrideHTML || this.indentation + this.defaultIndentation + property.html);
						break;
				}
			}
		}
	};

	function RootElement() {
		Element.apply(this, arguments);
	}

	RootElement.prototype = Object.create(Element.prototype);
	RootElement.prototype.make = function(){
		// RootElement is just an empty space
	};
	RootElement.prototype.collectOutput = function() {
		this.htmlOutput = [this.htmlContent.join(this.isPretty ? '\n': '')];
	};
	RootElement.prototype.processChildren = function() {
		this.defaultIndentation = '';
		return Element.prototype.processChildren.apply(this, arguments);
	};

	function Parser(parserConfig) {
		this.config = defaults(this.defaultConfig, parserConfig);
	}

	Parser.escapeHTML = escapeHTML;
	Parser.trim = trim;
	Parser.isArray =  isArray;

	Parser.Element = Element;
	Parser.RootElement = RootElement;

	Parser.properties = {
		Attribute: ConfigurablePropertyFactory('attributes', DEFAULT_ATTRIBUTES),
		Directive: ConfigurablePropertyFactory('directives', DEFAULT_DIRECTIVES),
		Pseudo: ConfigurablePropertyFactory('pseudos', DEFAULT_PSEUDOS)
	};

	Parser.prototype = {

		defaultConfig: {
			pretty: true,
			curly: false,
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

			if (!/^[\s\n\r]+$/.test(spec)) {
				if (singleRunConfig.curly) {
					spec += '\n/*siml:curly=true*/';
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
			} else {
				spec = [];
			}

			return new Parser.RootElement(
				['RootElement', spec[1]],
				singleRunConfig
			).html;
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
