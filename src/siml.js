var siml = typeof module != 'undefined' && module.exports ? module.exports : window.siml = {};
(function() {

	'use strict';

	var push = [].push;
	var unshift = [].unshift;

	var DEFAULT_TAG = 'div';
	var DEFAULT_INDENTATION = '  ';

	var SINGULAR_TAGS = {
		input: 1, img: 1, meta: 1, link: 1, br: 1, hr: 1,
		source: 1, area: 1, base: 1, col: 1
	};

	var DEFAULT_DIRECTIVES = {
		_fillHTML: {
			type: 'CONTENT',
			make: function(_, children, t) {
				return t;
			}
		},
		_default: {
			type: 'CONTENT',
			make: function(dir) {
				throw new Error('SIML: Directive not resolvable: ' + dir);
			}
		}
	};

	var DEFAULT_ATTRIBUTES = {
		_default: {
			type: 'ATTR',
			make: function(attrName, value) {
				if (value == null) {
					return attrName;
				}
				return attrName + '="' + value + '"';
			}
		},
		text: {
			type: 'CONTENT',
			make: function(_, t) {
				return t;
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

	var objCreate = Object.create || function (o) {
		function F() {}
		F.prototype = o;
		return new F();
	};

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

			var propName = args[0];
			var propArguments = args[1];
			var propChildren = args[2];

			if (propChildren) {
				propArguments.unshift(propChildren);
			}

			propArguments.unshift(propName);

			var propMaker = config[methodRepoName][propName] || fallbackMethodRepo[propName];
			if (!propMaker) {
				propMaker = config[methodRepoName]._default || fallbackMethodRepo._default;
			}

			if  (!propMaker) {
				throw new Error('SIML: No fallback for' + args.join());
			}

			this.type = propMaker.type;
			this.html = propMaker.make.apply(this, propArguments) || '';

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
		this.prototypes = objCreate(parentElement && parentElement.prototypes || null);

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

			var attributeMap = {};
			var selector = this.selector.slice();
			var selectorPortionType;
			var selectorPortion;
			
			this.augmentPrototypeSelector(selector);

			for (var i = 0, l = selector.length; i < l; ++i) {
				selectorPortionType = selector[i][0];
				selectorPortion = selector[i][1];
				switch (selectorPortionType) {
					case 'Tag':
						if (!this.tag) {
							this.tag = selectorPortion;
						}
						break;
					case 'Id':
						this.id = selectorPortion; break;
					case 'Attr':
						var attrName = selectorPortion[0];
						var attr = [attrName, [selectorPortion[1]]];
						// Attributes can only be defined once -- latest wins
						if (attributeMap[attrName] != null) {
							this.attrs[attributeMap[attrName]] = attr;
						} else {
							attributeMap[attrName] = this.attrs.push(attr) - 1;
						}
						break;
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
			} else {

				output.push('>');

				if (content.length) {
					isPretty && output.push('\n');
					output.push(content.join(isPretty ? '\n': ''));
					isPretty && output.push('\n' + indent);
				}

				output.push('</' + this.tag + '>');

			}

			if (this.multiplier > 1) {
				var all = output.join('');
				for (var m = this.multiplier - 1; m--;) {
					output.push(isPretty ? '\n' : '');
					output.push(all);
				}
			}

		},

		_makeExclusiveBranches: function(excGroup, specChildren, specChildIndex) {

			var tail = excGroup[2];
			var exclusives = excGroup[1];

			var branches = [];

			attachTail(excGroup, tail); 	

			for (var n = 0, nl = exclusives.length; n < nl; ++n) {
				specChildren[specChildIndex] = exclusives[n]; // Mutate
				var newBranch = deepCopyArray(this.spec);     // Complete copy
				specChildren[specChildIndex] = excGroup;      // Return to regular
				branches.push(newBranch);
			}

			return branches;

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
								if (type === 'IncGroup') {
									break;
								} else {
									continue;
								}
							}
						}
						hasAttached = attachTail(child, tail, {
							child: false,
							selector: false
						});
						// Prevent descendants from being attached to more than one sibling
						// e.g. a,b or a+b -- should only attach last one (i.e. b)
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

			var cl = children.length;
			var i;
			var childType;

			var exclusiveBranches = [];

			for (i = 0; i < cl; ++i) {
				if (children[i][0] === 'ExcGroup') {
					push.apply(
						exclusiveBranches,
						this._makeExclusiveBranches(children[i], children, i)
					);
				}
			}

			if (exclusiveBranches.length) {

				this.collectOutput = function(){};
				var html = [];

				for (var ei = 0, el = exclusiveBranches.length; ei < el; ++ei) {
					var branch = exclusiveBranches[ei];
					html.push(
						new (branch[0] === 'RootElement' ? RootElement : Element)(
							branch,
							this.config,
							this.parentElement,
							this.indentation
						).html
					);
				}

				this.htmlOutput.push(html.join(this.isPretty ? '\n' : ''));

			} else {
				for (i = 0; i < cl; ++i) {
					var child = children[i][1];
					var childType = children[i][0];
					switch (childType) {
						case 'Element':
							this.processElement(child);
							break;
						case 'Prototype':
							this.prototypes[child[0]] = this.augmentPrototypeSelector(child[1]);
							break;
						case 'IncGroup':
							this.processIncGroup(child);
							break;
						case 'ExcGroup':
							throw new Error('SIML: Found ExcGroup in unexpected location');
						default:
							this.processProperty(childType, child);
					}
				}
			}

		},

		processElement: function(spec) {
			this.htmlContent.push(
				new Generator.Element(
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

		processProperty: function(type, args) {
			// type = Attribute | Directive | Pseudo
			var property = new Generator.properties[type](
				args,
				this.config,
				this,
				this.indentation + this.defaultIndentation
			);
			if (property.html) {
				switch (property.type) {
					case 'ATTR':
						if (property.html) {
							this.htmlAttributes.push(property.html);
						}
						break;
					case 'CONTENT':
						if (property.html) {
							this.htmlContent.push(this.indentation + this.defaultIndentation + property.html);
						}
						break;
				}
			}
		},

		augmentPrototypeSelector: function(selector) {
			// Assume tag, if specified, to be first selector portion.
			if (selector[0][0] !== 'Tag') {
				return selector;
			}
			// Retrieve and unshift prototype selector portions:
			unshift.apply(selector, this.prototypes[selector[0][1]] || []);
			return selector;
		}
	};

	function RootElement() {
		Element.apply(this, arguments);
	}

	RootElement.prototype = objCreate(Element.prototype);
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

	function Generator(defaultGeneratorConfig) {
		this.config = defaults(this.defaultConfig, defaultGeneratorConfig);
	}

	Generator.escapeHTML = escapeHTML;
	Generator.trim = trim;
	Generator.isArray =  isArray;

	Generator.Element = Element;
	Generator.RootElement = RootElement;

	Generator.properties = {
		Attribute: ConfigurablePropertyFactory('attributes', DEFAULT_ATTRIBUTES),
		Directive: ConfigurablePropertyFactory('directives', DEFAULT_DIRECTIVES),
		Pseudo: ConfigurablePropertyFactory('pseudos', DEFAULT_PSEUDOS)
	};

	Generator.prototype = {

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
					// TODO: Find a nicer way of passing config to the PEGjs parser:
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

			if (spec[0] === 'Element') {
				return new Generator.Element(
					spec[1],
					singleRunConfig
				).html;
			}

			return new Generator.RootElement(
				['RootElement', [['IncGroup', [spec]]]],
				singleRunConfig
			).html;
		}

	};

	siml.Generator = Generator;

	siml.defaultGenerator = new Generator({
		pretty: true,
		indent: DEFAULT_INDENTATION
	});

	siml.parse = function(s, c) {
		return siml.defaultGenerator.parse(s, c);
	};

}());
