/**
 * SIML (c) James Padolsey 2013
 * @version 0.3.4
 * @license https://github.com/padolsey/SIML/blob/master/LICENSE-MIT
 * @info http://github.com/padolsey/SIML
 */
(function() {

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

	siml.html5 = new siml.Generator({
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
					if (this.parentElement.tag === 'input' && INPUT_TYPES.hasOwnProperty(name)) {
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


siml.angular = new siml.Generator({
	pretty: true,
	toTag: siml.html5.config.toTag,
	directives: {
		doctype: siml.html5.config.directives.doctype,
		dt: siml.html5.config.directives.dt,
		_default: {
			type: 'ATTR',
			make: function(name, children, value) {
				// camelCase -> snake-case
				name = name.replace(/([a-z])([A-Z])/g, function($0,$1,$2) {
					return $1 + '-' + $2.toLowerCase();
				});
				if (name.substring(0, 1) === '$') {
					name = name.substring(1);
				} else {
					name = 'ng-' + name;
				}
				return name + '="' + value + '"';
			}
		}
	},
	pseudos: {
		_default: {
			type: 'ATTR',
			make: function(name) {
				if (this.parentElement.tag === 'input' && siml.html5.INPUT_TYPES.hasOwnProperty(name)) {
					return 'type="' + name + '"';
				}
				// camelCase -> snake-case
				return 'ng-' + name.replace(/([a-z])([A-Z])/g, function($0,$1,$2) {
					return $1 + '-' + $2.toLowerCase();
				});
			}
		}
	}
});

siml.PARSER = (function(){
  /*
   * Generated by PEG.js 0.7.0.
   *
   * http://pegjs.majda.cz/
   */
  
  function quote(s) {
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
     * string literal except for the closing quote character, backslash,
     * carriage return, line separator, paragraph separator, and line feed.
     * Any character may appear in the form of an escape sequence.
     *
     * For portability, we also escape escape all control and non-ASCII
     * characters. Note that "\0" and "\v" escape sequences are not used
     * because JSHint does not like the first and IE the second.
     */
     return '"' + s
      .replace(/\\/g, '\\\\')  // backslash
      .replace(/"/g, '\\"')    // closing quote character
      .replace(/\x08/g, '\\b') // backspace
      .replace(/\t/g, '\\t')   // horizontal tab
      .replace(/\n/g, '\\n')   // line feed
      .replace(/\f/g, '\\f')   // form feed
      .replace(/\r/g, '\\r')   // carriage return
      .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
      + '"';
  }
  
  var result = {
    /*
     * Parses the input with a generated parser. If the parsing is successfull,
     * returns a value explicitly or implicitly specified by the grammar from
     * which the parser was generated (see |PEG.buildParser|). If the parsing is
     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
     */
    parse: function(input, startRule) {
      var parseFunctions = {
        "MSeries": parse_MSeries,
        "CSeries": parse_CSeries,
        "LSeries": parse_LSeries,
        "ExcGroupRHS": parse_ExcGroupRHS,
        "ChildrenDeclaration": parse_ChildrenDeclaration,
        "Single": parse_Single,
        "Element": parse_Element,
        "PrototypeDefinition": parse_PrototypeDefinition,
        "PrototypeName": parse_PrototypeName,
        "SingleSelector": parse_SingleSelector,
        "selectorRepeatableComponent": parse_selectorRepeatableComponent,
        "selectorTag": parse_selectorTag,
        "selectorIdClass": parse_selectorIdClass,
        "selectorAttr": parse_selectorAttr,
        "selectorPseudo": parse_selectorPseudo,
        "selectorAttrValue": parse_selectorAttrValue,
        "Text": parse_Text,
        "HTML": parse_HTML,
        "Attribute": parse_Attribute,
        "attributeName": parse_attributeName,
        "Directive": parse_Directive,
        "DirectiveName": parse_DirectiveName,
        "DirectiveArguments": parse_DirectiveArguments,
        "DirectiveChildren": parse_DirectiveChildren,
        "braced": parse_braced,
        "nonBraceCharacters": parse_nonBraceCharacters,
        "nonBraceCharacter": parse_nonBraceCharacter,
        "arrayElements": parse_arrayElements,
        "value": parse_value,
        "string": parse_string,
        "html": parse_html,
        "simpleString": parse_simpleString,
        "number": parse_number,
        "int": parse_int,
        "frac": parse_frac,
        "exp": parse_exp,
        "digits": parse_digits,
        "e": parse_e,
        "digit": parse_digit,
        "digit19": parse_digit19,
        "hexDigit": parse_hexDigit,
        "_": parse__
      };
      
      if (startRule !== undefined) {
        if (parseFunctions[startRule] === undefined) {
          throw new Error("Invalid rule name: " + quote(startRule) + ".");
        }
      } else {
        startRule = "MSeries";
      }
      
      var pos = { offset: 0, line: 1, column: 1, seenCR: false };
      var reportFailures = 0;
      var rightmostFailuresPos = { offset: 0, line: 1, column: 1, seenCR: false };
      var rightmostFailuresExpected = [];
      
      function padLeft(input, padding, length) {
        var result = input;
        
        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }
        
        return result;
      }
      
      function escape(ch) {
        var charCode = ch.charCodeAt(0);
        var escapeChar;
        var length;
        
        if (charCode <= 0xFF) {
          escapeChar = 'x';
          length = 2;
        } else {
          escapeChar = 'u';
          length = 4;
        }
        
        return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
      }
      
      function clone(object) {
        var result = {};
        for (var key in object) {
          result[key] = object[key];
        }
        return result;
      }
      
      function advance(pos, n) {
        var endOffset = pos.offset + n;
        
        for (var offset = pos.offset; offset < endOffset; offset++) {
          var ch = input.charAt(offset);
          if (ch === "\n") {
            if (!pos.seenCR) { pos.line++; }
            pos.column = 1;
            pos.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            pos.line++;
            pos.column = 1;
            pos.seenCR = true;
          } else {
            pos.column++;
            pos.seenCR = false;
          }
        }
        
        pos.offset += n;
      }
      
      function matchFailed(failure) {
        if (pos.offset < rightmostFailuresPos.offset) {
          return;
        }
        
        if (pos.offset > rightmostFailuresPos.offset) {
          rightmostFailuresPos = clone(pos);
          rightmostFailuresExpected = [];
        }
        
        rightmostFailuresExpected.push(failure);
      }
      
      function parse_MSeries() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1, pos2;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse__();
        if (result0 !== null) {
          result1 = parse_CSeries();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = [];
            pos2 = clone(pos);
            result3 = [];
            if (/^[\r\n\t ]/.test(input.charAt(pos.offset))) {
              result4 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result4 = null;
              if (reportFailures === 0) {
                matchFailed("[\\r\\n\\t ]");
              }
            }
            while (result4 !== null) {
              result3.push(result4);
              if (/^[\r\n\t ]/.test(input.charAt(pos.offset))) {
                result4 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result4 = null;
                if (reportFailures === 0) {
                  matchFailed("[\\r\\n\\t ]");
                }
              }
            }
            if (result3 !== null) {
              result4 = parse_CSeries();
              if (result4 !== null) {
                result3 = [result3, result4];
              } else {
                result3 = null;
                pos = clone(pos2);
              }
            } else {
              result3 = null;
              pos = clone(pos2);
            }
            while (result3 !== null) {
              result2.push(result3);
              pos2 = clone(pos);
              result3 = [];
              if (/^[\r\n\t ]/.test(input.charAt(pos.offset))) {
                result4 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result4 = null;
                if (reportFailures === 0) {
                  matchFailed("[\\r\\n\\t ]");
                }
              }
              while (result4 !== null) {
                result3.push(result4);
                if (/^[\r\n\t ]/.test(input.charAt(pos.offset))) {
                  result4 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result4 = null;
                  if (reportFailures === 0) {
                    matchFailed("[\\r\\n\\t ]");
                  }
                }
              }
              if (result3 !== null) {
                result4 = parse_CSeries();
                if (result4 !== null) {
                  result3 = [result3, result4];
                } else {
                  result3 = null;
                  pos = clone(pos2);
                }
              } else {
                result3 = null;
                pos = clone(pos2);
              }
            }
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, head, body) {
        		if (!head) {
        			return ['IncGroup', []];
        		}
        
        		var all = [];
        
        		if (head[0] !== 'Element' || body.length) {
        			head = ['IncGroup', [head]];
        		}
        
        		for (var i = 0, l = body.length; i < l; ++i) {
        			head[1].push(body[i][1]);
        		}
        
        		return head;
        	})(pos0.offset, pos0.line, pos0.column, result0[1], result0[2]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_CSeries() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1, pos2;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_LSeries();
        if (result0 !== null) {
          pos2 = clone(pos);
          result1 = parse__();
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 44) {
              result2 = ",";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\",\"");
              }
            }
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                result4 = parse_CSeries();
                if (result4 !== null) {
                  result1 = [result1, result2, result3, result4];
                } else {
                  result1 = null;
                  pos = clone(pos2);
                }
              } else {
                result1 = null;
                pos = clone(pos2);
              }
            } else {
              result1 = null;
              pos = clone(pos2);
            }
          } else {
            result1 = null;
            pos = clone(pos2);
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, a, b) {
        		if (b[3]) {
        			return ['IncGroup', [a, b[3]], 'CommaGroup']; 
        		}
        		return a;
        	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_LSeries() {
        var result0, result1, result2, result3, result4, result5, result6, result7, result8;
        var pos0, pos1, pos2;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_Single();
        if (result0 !== null) {
          pos2 = clone(pos);
          result1 = [];
          if (/^[> \t+]/.test(input.charAt(pos.offset))) {
            result2 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[> \\t+]");
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            if (/^[> \t+]/.test(input.charAt(pos.offset))) {
              result2 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("[> \\t+]");
              }
            }
          }
          if (result1 !== null) {
            result2 = parse_LSeries();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = clone(pos2);
            }
          } else {
            result1 = null;
            pos = clone(pos2);
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = parse__();
            if (result2 !== null) {
              result3 = parse_ChildrenDeclaration();
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, singleA, tail, decl) {
        
        		var seperator = tail[0] && tail[0].join('');
        		var singleB = tail[1];
        
        		if (decl) {
        			var declarationChildren = decl[1][0];
        			if (singleB) {
        				if (singleB[0] === 'Element') singleB[1][1].push(declarationChildren);
        			} else {
        				if (singleA[0] === 'Element') singleA[1][1].push(declarationChildren);
        			}
        		}
        
        		if (!tail.length) {
        			return singleA;
        		}
        
        		switch (singleA[0]) {
        			case 'Element': {
        
        				if (seperator.indexOf(',') > -1 || seperator.indexOf('+') > -1) {
        					return ['IncGroup', [singleA,singleB]];
        				}
        
        				// a>b
        				if (singleA[0] === 'Element') {
        					singleA[1][1].push(singleB); 
        				} else if (singleA[0] === 'IncGroup' || singleA[0] === 'ExcGroup') {
        					singleA[1].push(singleB);
        				}
        
        				return singleA;
        			}
        			case 'Prototype':
        			case 'Directive':
        			case 'Attribute': {
        				return ['IncGroup', [singleA, singleB]];
        			}
        		}
        		return 'ERROR';
        	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[1], result0[3]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          if (input.charCodeAt(pos.offset) === 40) {
            result0 = "(";
            advance(pos, 1);
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"(\"");
            }
          }
          if (result0 !== null) {
            result1 = parse__();
            if (result1 !== null) {
              result2 = parse_MSeries();
              if (result2 !== null) {
                result3 = [];
                pos2 = clone(pos);
                result4 = parse__();
                if (result4 !== null) {
                  if (input.charCodeAt(pos.offset) === 47) {
                    result5 = "/";
                    advance(pos, 1);
                  } else {
                    result5 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"/\"");
                    }
                  }
                  if (result5 !== null) {
                    result6 = parse__();
                    if (result6 !== null) {
                      result7 = parse_MSeries();
                      if (result7 !== null) {
                        result4 = [result4, result5, result6, result7];
                      } else {
                        result4 = null;
                        pos = clone(pos2);
                      }
                    } else {
                      result4 = null;
                      pos = clone(pos2);
                    }
                  } else {
                    result4 = null;
                    pos = clone(pos2);
                  }
                } else {
                  result4 = null;
                  pos = clone(pos2);
                }
                while (result4 !== null) {
                  result3.push(result4);
                  pos2 = clone(pos);
                  result4 = parse__();
                  if (result4 !== null) {
                    if (input.charCodeAt(pos.offset) === 47) {
                      result5 = "/";
                      advance(pos, 1);
                    } else {
                      result5 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"/\"");
                      }
                    }
                    if (result5 !== null) {
                      result6 = parse__();
                      if (result6 !== null) {
                        result7 = parse_MSeries();
                        if (result7 !== null) {
                          result4 = [result4, result5, result6, result7];
                        } else {
                          result4 = null;
                          pos = clone(pos2);
                        }
                      } else {
                        result4 = null;
                        pos = clone(pos2);
                      }
                    } else {
                      result4 = null;
                      pos = clone(pos2);
                    }
                  } else {
                    result4 = null;
                    pos = clone(pos2);
                  }
                }
                if (result3 !== null) {
                  result4 = parse__();
                  if (result4 !== null) {
                    if (input.charCodeAt(pos.offset) === 41) {
                      result5 = ")";
                      advance(pos, 1);
                    } else {
                      result5 = null;
                      if (reportFailures === 0) {
                        matchFailed("\")\"");
                      }
                    }
                    if (result5 !== null) {
                      result6 = [];
                      result7 = parse_selectorRepeatableComponent();
                      while (result7 !== null) {
                        result6.push(result7);
                        result7 = parse_selectorRepeatableComponent();
                      }
                      if (result6 !== null) {
                        result7 = parse__();
                        if (result7 !== null) {
                          result8 = parse_ExcGroupRHS();
                          result8 = result8 !== null ? result8 : "";
                          if (result8 !== null) {
                            result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8];
                          } else {
                            result0 = null;
                            pos = clone(pos1);
                          }
                        } else {
                          result0 = null;
                          pos = clone(pos1);
                        }
                      } else {
                        result0 = null;
                        pos = clone(pos1);
                      }
                    } else {
                      result0 = null;
                      pos = clone(pos1);
                    }
                  } else {
                    result0 = null;
                    pos = clone(pos1);
                  }
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
          if (result0 !== null) {
            result0 = (function(offset, line, column, head, body, selector, tail) {
          
          		var all = [];
          		var separator = '';
          
          		body.unshift([,,,head]);
          
          		if (tail) {
          			if (tail[0] === 'Declaration') {
          				tail = tail[1][0];
          			} else {
          				separator = tail[1];
          				tail = tail[0];
          			}
          		}
          
          		for (var i = 0, l = body.length; i < l; ++i) {
          			if (body[i][3][2] === 'CommaGroup') {
          				// Make (a,b,c/g) be considered as ((a/b/c/)/g)
          				body[i][3][0] = 'ExcGroup';
          				body[i][3][2] = [];
          			}
          			all.push(body[i][3]);
          		}
          		return ['ExcGroup', all, [
          			tail,
          			selector,
          			separator.indexOf('+') > -1 ? 'sibling' : 'descendent'
          		]];
          	})(pos0.offset, pos0.line, pos0.column, result0[2], result0[3], result0[6], result0[8]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
        }
        return result0;
      }
      
      function parse_ExcGroupRHS() {
        var result0, result1;
        var pos0, pos1;
        
        result0 = parse_ChildrenDeclaration();
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          result0 = [];
          if (/^[> \t+]/.test(input.charAt(pos.offset))) {
            result1 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[> \\t+]");
            }
          }
          while (result1 !== null) {
            result0.push(result1);
            if (/^[> \t+]/.test(input.charAt(pos.offset))) {
              result1 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[> \\t+]");
              }
            }
          }
          if (result0 !== null) {
            result1 = parse_LSeries();
            if (result1 !== null) {
              result0 = [result0, result1];
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
          if (result0 !== null) {
            result0 = (function(offset, line, column, separator, tail) {
          		return [tail, separator];
          	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
        }
        return result0;
      }
      
      function parse_ChildrenDeclaration() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 123) {
          result0 = "{";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"{\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_MSeries();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 125) {
              result2 = "}";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"}\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, c) {
        		return ['Declaration', [c]];
        	})(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_Single() {
        var result0;
        
        result0 = parse_Attribute();
        if (result0 === null) {
          result0 = parse_PrototypeDefinition();
          if (result0 === null) {
            result0 = parse_Element();
            if (result0 === null) {
              result0 = parse_Text();
              if (result0 === null) {
                result0 = parse_HTML();
                if (result0 === null) {
                  result0 = parse_Directive();
                }
              }
            }
          }
        }
        return result0;
      }
      
      function parse_Element() {
        var result0;
        var pos0;
        
        pos0 = clone(pos);
        result0 = parse_SingleSelector();
        if (result0 !== null) {
          result0 = (function(offset, line, column, s) {
        		return ['Element', [s,[]]];
        	})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_PrototypeDefinition() {
        var result0, result1, result2, result3, result4, result5, result6;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_PrototypeName();
        if (result0 !== null) {
          result1 = [];
          if (/^[ \t]/.test(input.charAt(pos.offset))) {
            result2 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[ \\t]");
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            if (/^[ \t]/.test(input.charAt(pos.offset))) {
              result2 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("[ \\t]");
              }
            }
          }
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 61) {
              result2 = "=";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"=\"");
              }
            }
            if (result2 !== null) {
              result3 = [];
              if (/^[ \t]/.test(input.charAt(pos.offset))) {
                result4 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result4 = null;
                if (reportFailures === 0) {
                  matchFailed("[ \\t]");
                }
              }
              while (result4 !== null) {
                result3.push(result4);
                if (/^[ \t]/.test(input.charAt(pos.offset))) {
                  result4 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result4 = null;
                  if (reportFailures === 0) {
                    matchFailed("[ \\t]");
                  }
                }
              }
              if (result3 !== null) {
                result4 = parse_SingleSelector();
                if (result4 !== null) {
                  result5 = [];
                  if (/^[ \t]/.test(input.charAt(pos.offset))) {
                    result6 = input.charAt(pos.offset);
                    advance(pos, 1);
                  } else {
                    result6 = null;
                    if (reportFailures === 0) {
                      matchFailed("[ \\t]");
                    }
                  }
                  while (result6 !== null) {
                    result5.push(result6);
                    if (/^[ \t]/.test(input.charAt(pos.offset))) {
                      result6 = input.charAt(pos.offset);
                      advance(pos, 1);
                    } else {
                      result6 = null;
                      if (reportFailures === 0) {
                        matchFailed("[ \\t]");
                      }
                    }
                  }
                  if (result5 !== null) {
                    if (input.charCodeAt(pos.offset) === 59) {
                      result6 = ";";
                      advance(pos, 1);
                    } else {
                      result6 = null;
                      if (reportFailures === 0) {
                        matchFailed("\";\"");
                      }
                    }
                    result6 = result6 !== null ? result6 : "";
                    if (result6 !== null) {
                      result0 = [result0, result1, result2, result3, result4, result5, result6];
                    } else {
                      result0 = null;
                      pos = clone(pos1);
                    }
                  } else {
                    result0 = null;
                    pos = clone(pos1);
                  }
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, name, s) {
        		return ['Prototype', [name, s]];
        	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_PrototypeName() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (/^[a-zA-Z_$]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z_$]");
          }
        }
        if (result0 !== null) {
          result1 = [];
          if (/^[a-zA-Z0-9$_\-]/.test(input.charAt(pos.offset))) {
            result2 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[a-zA-Z0-9$_\\-]");
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            if (/^[a-zA-Z0-9$_\-]/.test(input.charAt(pos.offset))) {
              result2 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("[a-zA-Z0-9$_\\-]");
              }
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, a, b) { return a+b.join(''); })(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_SingleSelector() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_selectorTag();
        if (result0 !== null) {
          result1 = [];
          result2 = parse_selectorRepeatableComponent();
          while (result2 !== null) {
            result1.push(result2);
            result2 = parse_selectorRepeatableComponent();
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, s) {
        		s[1].unshift(s[0]);
        		return s[1];
        	})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          result1 = parse_selectorRepeatableComponent();
          if (result1 !== null) {
            result0 = [];
            while (result1 !== null) {
              result0.push(result1);
              result1 = parse_selectorRepeatableComponent();
            }
          } else {
            result0 = null;
          }
          if (result0 !== null) {
            result0 = (function(offset, line, column, s) {
          		return s;
          	})(pos0.offset, pos0.line, pos0.column, result0);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
        }
        return result0;
      }
      
      function parse_selectorRepeatableComponent() {
        var result0;
        
        result0 = parse_selectorIdClass();
        if (result0 === null) {
          result0 = parse_selectorPseudo();
          if (result0 === null) {
            result0 = parse_selectorAttr();
          }
        }
        return result0;
      }
      
      function parse_selectorTag() {
        var result0, result1;
        var pos0;
        
        pos0 = clone(pos);
        if (/^[a-z0-9_\-]/i.test(input.charAt(pos.offset))) {
          result1 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[a-z0-9_\\-]i");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[a-z0-9_\-]/i.test(input.charAt(pos.offset))) {
              result1 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[a-z0-9_\\-]i");
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, t) { return ['Tag', t.join('')]; })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_selectorIdClass() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (/^[#.]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[#.]");
          }
        }
        if (result0 !== null) {
          if (/^[a-z0-9\-_$]/i.test(input.charAt(pos.offset))) {
            result2 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[a-z0-9\\-_$]i");
            }
          }
          if (result2 !== null) {
            result1 = [];
            while (result2 !== null) {
              result1.push(result2);
              if (/^[a-z0-9\-_$]/i.test(input.charAt(pos.offset))) {
                result2 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("[a-z0-9\\-_$]i");
                }
              }
            }
          } else {
            result1 = null;
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, f, t) {
        		return [
        			f === '#'  ? 'Id' : 'Class',
        			t.join('')
        		];
        	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_selectorAttr() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 91) {
          result0 = "[";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"[\"");
          }
        }
        if (result0 !== null) {
          if (/^[^[\]=]/.test(input.charAt(pos.offset))) {
            result2 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[^[\\]=]");
            }
          }
          if (result2 !== null) {
            result1 = [];
            while (result2 !== null) {
              result1.push(result2);
              if (/^[^[\]=]/.test(input.charAt(pos.offset))) {
                result2 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("[^[\\]=]");
                }
              }
            }
          } else {
            result1 = null;
          }
          if (result1 !== null) {
            pos2 = clone(pos);
            if (input.charCodeAt(pos.offset) === 61) {
              result2 = "=";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"=\"");
              }
            }
            if (result2 !== null) {
              result3 = parse_selectorAttrValue();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = clone(pos2);
              }
            } else {
              result2 = null;
              pos = clone(pos2);
            }
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              if (input.charCodeAt(pos.offset) === 93) {
                result3 = "]";
                advance(pos, 1);
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\"]\"");
                }
              }
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, name, value) {
        		return ['Attr', [name.join(''), value.length ? value[1] : null]];
        	})(pos0.offset, pos0.line, pos0.column, result0[1], result0[2]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_selectorPseudo() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 58) {
          result0 = ":";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\":\"");
          }
        }
        if (result0 !== null) {
          pos2 = clone(pos);
          reportFailures++;
          result1 = parse_string();
          reportFailures--;
          if (result1 === null) {
            result1 = "";
          } else {
            result1 = null;
            pos = clone(pos2);
          }
          if (result1 !== null) {
            if (/^[a-z0-9\-_$]/i.test(input.charAt(pos.offset))) {
              result3 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result3 = null;
              if (reportFailures === 0) {
                matchFailed("[a-z0-9\\-_$]i");
              }
            }
            if (result3 !== null) {
              result2 = [];
              while (result3 !== null) {
                result2.push(result3);
                if (/^[a-z0-9\-_$]/i.test(input.charAt(pos.offset))) {
                  result3 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("[a-z0-9\\-_$]i");
                  }
                }
              }
            } else {
              result2 = null;
            }
            if (result2 !== null) {
              result3 = parse_braced();
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, t, arg) {
        		return ['Pseudo', [
        			t.join(''),
        			[
        				arg && arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')
        			]
        		]];
        	})(pos0.offset, pos0.line, pos0.column, result0[2], result0[3]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_selectorAttrValue() {
        var result0, result1;
        var pos0;
        
        pos0 = clone(pos);
        result0 = parse_string();
        if (result0 !== null) {
          result0 = (function(offset, line, column, v) { return v; })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          if (/^[^[\]]/.test(input.charAt(pos.offset))) {
            result1 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[^[\\]]");
            }
          }
          if (result1 !== null) {
            result0 = [];
            while (result1 !== null) {
              result0.push(result1);
              if (/^[^[\]]/.test(input.charAt(pos.offset))) {
                result1 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("[^[\\]]");
                }
              }
            }
          } else {
            result0 = null;
          }
          if (result0 !== null) {
            result0 = (function(offset, line, column, v) { return v.join(''); })(pos0.offset, pos0.line, pos0.column, result0);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
        }
        return result0;
      }
      
      function parse_Text() {
        var result0;
        var pos0;
        
        pos0 = clone(pos);
        result0 = parse_string();
        if (result0 !== null) {
          result0 = (function(offset, line, column, s) {
        		return ['Directive', ['_fillHTML', [escapeHTML(s)], []]];
        	})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_HTML() {
        var result0;
        var pos0;
        
        pos0 = clone(pos);
        result0 = parse_html();
        if (result0 !== null) {
          result0 = (function(offset, line, column, s) {
        		return ['Directive', ['_fillHTML', [s], []]];
        	})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_Attribute() {
        var result0, result1, result2, result3, result4, result5, result6;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_attributeName();
        if (result0 !== null) {
          result1 = parse__();
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 58) {
              result2 = ":";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\":\"");
              }
            }
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                result4 = parse_value();
                if (result4 !== null) {
                  result5 = parse__();
                  if (result5 !== null) {
                    if (input.charCodeAt(pos.offset) === 59) {
                      result6 = ";";
                      advance(pos, 1);
                    } else {
                      result6 = null;
                      if (reportFailures === 0) {
                        matchFailed("\";\"");
                      }
                    }
                    if (result6 !== null) {
                      result0 = [result0, result1, result2, result3, result4, result5, result6];
                    } else {
                      result0 = null;
                      pos = clone(pos1);
                    }
                  } else {
                    result0 = null;
                    pos = clone(pos1);
                  }
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, name, value) {
        		return ['Attribute', [name, [value]]];
        	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          result0 = parse_attributeName();
          if (result0 !== null) {
            result1 = parse__();
            if (result1 !== null) {
              if (input.charCodeAt(pos.offset) === 58) {
                result2 = ":";
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\":\"");
                }
              }
              if (result2 !== null) {
                result3 = parse__();
                if (result3 !== null) {
                  result4 = parse_string();
                  if (result4 !== null) {
                    result0 = [result0, result1, result2, result3, result4];
                  } else {
                    result0 = null;
                    pos = clone(pos1);
                  }
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
          if (result0 !== null) {
            result0 = (function(offset, line, column, name, value) {
          		return ['Attribute', [name, [escapeHTML(value)]]];
          	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
          if (result0 === null) {
            pos0 = clone(pos);
            pos1 = clone(pos);
            result0 = parse_attributeName();
            if (result0 !== null) {
              result1 = parse__();
              if (result1 !== null) {
                if (input.charCodeAt(pos.offset) === 58) {
                  result2 = ":";
                  advance(pos, 1);
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("\":\"");
                  }
                }
                if (result2 !== null) {
                  result3 = parse__();
                  if (result3 !== null) {
                    result4 = parse_html();
                    if (result4 !== null) {
                      result0 = [result0, result1, result2, result3, result4];
                    } else {
                      result0 = null;
                      pos = clone(pos1);
                    }
                  } else {
                    result0 = null;
                    pos = clone(pos1);
                  }
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
            if (result0 !== null) {
              result0 = (function(offset, line, column, name, value) {
            		return ['Attribute', [name, [value]]];
            	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
            }
            if (result0 === null) {
              pos = clone(pos0);
            }
            if (result0 === null) {
              pos0 = clone(pos);
              pos1 = clone(pos);
              result0 = parse_attributeName();
              if (result0 !== null) {
                result1 = parse__();
                if (result1 !== null) {
                  if (input.charCodeAt(pos.offset) === 58) {
                    result2 = ":";
                    advance(pos, 1);
                  } else {
                    result2 = null;
                    if (reportFailures === 0) {
                      matchFailed("\":\"");
                    }
                  }
                  if (result2 !== null) {
                    if (/^[ \t]/.test(input.charAt(pos.offset))) {
                      result3 = input.charAt(pos.offset);
                      advance(pos, 1);
                    } else {
                      result3 = null;
                      if (reportFailures === 0) {
                        matchFailed("[ \\t]");
                      }
                    }
                    if (result3 !== null) {
                      result4 = parse_value();
                      if (result4 !== null) {
                        result0 = [result0, result1, result2, result3, result4];
                      } else {
                        result0 = null;
                        pos = clone(pos1);
                      }
                    } else {
                      result0 = null;
                      pos = clone(pos1);
                    }
                  } else {
                    result0 = null;
                    pos = clone(pos1);
                  }
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
              if (result0 !== null) {
                result0 = (function(offset, line, column, name, value) { // explicit space
              		return ['Attribute', [name, [value]]];
              	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
              }
              if (result0 === null) {
                pos = clone(pos0);
              }
            }
          }
        }
        return result0;
      }
      
      function parse_attributeName() {
        var result0, result1;
        var pos0;
        
        reportFailures++;
        pos0 = clone(pos);
        if (/^[A-Za-z0-9\-_]/.test(input.charAt(pos.offset))) {
          result1 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[A-Za-z0-9\\-_]");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[A-Za-z0-9\-_]/.test(input.charAt(pos.offset))) {
              result1 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[A-Za-z0-9\\-_]");
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, name) { return name.join(''); })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          result0 = parse_string();
          if (result0 === null) {
            result0 = parse_html();
          }
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("AttributeName");
        }
        return result0;
      }
      
      function parse_Directive() {
        var result0, result1, result2;
        var pos0, pos1;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_DirectiveName();
        if (result0 !== null) {
          result1 = parse_DirectiveArguments();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = parse_DirectiveChildren();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, name, args, children) {
        		return ['Directive', [
        			name,
        			args || [],
        			children || []
        		]];
        	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[1], result0[2]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("Directive");
        }
        return result0;
      }
      
      function parse_DirectiveName() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 64) {
          result0 = "@";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"@\"");
          }
        }
        if (result0 !== null) {
          if (/^[a-zA-Z_$]/.test(input.charAt(pos.offset))) {
            result1 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[a-zA-Z_$]");
            }
          }
          if (result1 !== null) {
            result2 = [];
            if (/^[a-zA-Z0-9$_]/.test(input.charAt(pos.offset))) {
              result3 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result3 = null;
              if (reportFailures === 0) {
                matchFailed("[a-zA-Z0-9$_]");
              }
            }
            while (result3 !== null) {
              result2.push(result3);
              if (/^[a-zA-Z0-9$_]/.test(input.charAt(pos.offset))) {
                result3 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("[a-zA-Z0-9$_]");
                }
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, a, b) { return a+b.join(''); })(pos0.offset, pos0.line, pos0.column, result0[1], result0[2]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_DirectiveArguments() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 40) {
          result0 = "(";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"(\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_arrayElements();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 41) {
              result2 = ")";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\")\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, args) {
        		return args;
        	})(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          result0 = parse_braced();
          if (result0 !== null) {
            result0 = (function(offset, line, column, arg) {
          		return [
          			arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')
          		];
          	})(pos0.offset, pos0.line, pos0.column, result0);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
        }
        return result0;
      }
      
      function parse_DirectiveChildren() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        
        pos0 = clone(pos);
        if (input.charCodeAt(pos.offset) === 59) {
          result0 = ";";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\";\"");
          }
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column) {
        		return [];
        	})(pos0.offset, pos0.line, pos0.column);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          result0 = parse__();
          if (result0 !== null) {
            if (input.charCodeAt(pos.offset) === 123) {
              result1 = "{";
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"{\"");
              }
            }
            if (result1 !== null) {
              result2 = parse_MSeries();
              result2 = result2 !== null ? result2 : "";
              if (result2 !== null) {
                if (input.charCodeAt(pos.offset) === 125) {
                  result3 = "}";
                  advance(pos, 1);
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"}\"");
                  }
                }
                if (result3 !== null) {
                  result0 = [result0, result1, result2, result3];
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
          if (result0 !== null) {
            result0 = (function(offset, line, column, c) {
          		return [c];
          	})(pos0.offset, pos0.line, pos0.column, result0[2]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
          if (result0 === null) {
            pos0 = clone(pos);
            pos1 = clone(pos);
            result0 = [];
            if (/^[> \t]/.test(input.charAt(pos.offset))) {
              result1 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[> \\t]");
              }
            }
            while (result1 !== null) {
              result0.push(result1);
              if (/^[> \t]/.test(input.charAt(pos.offset))) {
                result1 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("[> \\t]");
                }
              }
            }
            if (result0 !== null) {
              result1 = parse_LSeries();
              if (result1 !== null) {
                result0 = [result0, result1];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
            if (result0 !== null) {
              result0 = (function(offset, line, column, tail) {
            		return [tail];
            	})(pos0.offset, pos0.line, pos0.column, result0[1]);
            }
            if (result0 === null) {
              pos = clone(pos0);
            }
          }
        }
        return result0;
      }
      
      function parse_braced() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 40) {
          result0 = "(";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"(\"");
          }
        }
        if (result0 !== null) {
          result1 = [];
          result2 = parse_braced();
          if (result2 === null) {
            result2 = parse_nonBraceCharacter();
          }
          while (result2 !== null) {
            result1.push(result2);
            result2 = parse_braced();
            if (result2 === null) {
              result2 = parse_nonBraceCharacter();
            }
          }
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 41) {
              result2 = ")";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\")\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, parts) {
              return '(' + parts.join('') + ')';
            })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_nonBraceCharacters() {
        var result0, result1;
        var pos0;
        
        pos0 = clone(pos);
        result1 = parse_nonBraceCharacter();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_nonBraceCharacter();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, chars) { return chars.join(''); })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_nonBraceCharacter() {
        var result0;
        
        if (/^[^()]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[^()]");
          }
        }
        return result0;
      }
      
      function parse_arrayElements() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1, pos2;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_value();
        if (result0 !== null) {
          result1 = [];
          pos2 = clone(pos);
          if (input.charCodeAt(pos.offset) === 44) {
            result2 = ",";
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("\",\"");
            }
          }
          if (result2 !== null) {
            result3 = parse__();
            if (result3 !== null) {
              result4 = parse_value();
              if (result4 !== null) {
                result2 = [result2, result3, result4];
              } else {
                result2 = null;
                pos = clone(pos2);
              }
            } else {
              result2 = null;
              pos = clone(pos2);
            }
          } else {
            result2 = null;
            pos = clone(pos2);
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = clone(pos);
            if (input.charCodeAt(pos.offset) === 44) {
              result2 = ",";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\",\"");
              }
            }
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                result4 = parse_value();
                if (result4 !== null) {
                  result2 = [result2, result3, result4];
                } else {
                  result2 = null;
                  pos = clone(pos2);
                }
              } else {
                result2 = null;
                pos = clone(pos2);
              }
            } else {
              result2 = null;
              pos = clone(pos2);
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, head, tail) {
        			var result = [head];
        			for (var i = 0; i < tail.length; i++) {
        				result.push(tail[i][2]);
        			}
        			return result;
        		})(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_value() {
        var result0, result1;
        var pos0, pos1;
        
        pos0 = clone(pos);
        result0 = parse_string();
        if (result0 !== null) {
          result0 = (function(offset, line, column, s) {
        		return escapeHTML(s);
        	})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          result0 = parse_simpleString();
          if (result0 === null) {
            result0 = parse_html();
            if (result0 === null) {
              result0 = parse_number();
              if (result0 === null) {
                pos0 = clone(pos);
                pos1 = clone(pos);
                if (input.substr(pos.offset, 4) === "true") {
                  result0 = "true";
                  advance(pos, 4);
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"true\"");
                  }
                }
                if (result0 !== null) {
                  result1 = parse__();
                  if (result1 !== null) {
                    result0 = [result0, result1];
                  } else {
                    result0 = null;
                    pos = clone(pos1);
                  }
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
                if (result0 !== null) {
                  result0 = (function(offset, line, column) { return true;	 })(pos0.offset, pos0.line, pos0.column);
                }
                if (result0 === null) {
                  pos = clone(pos0);
                }
                if (result0 === null) {
                  pos0 = clone(pos);
                  pos1 = clone(pos);
                  if (input.substr(pos.offset, 5) === "false") {
                    result0 = "false";
                    advance(pos, 5);
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"false\"");
                    }
                  }
                  if (result0 !== null) {
                    result1 = parse__();
                    if (result1 !== null) {
                      result0 = [result0, result1];
                    } else {
                      result0 = null;
                      pos = clone(pos1);
                    }
                  } else {
                    result0 = null;
                    pos = clone(pos1);
                  }
                  if (result0 !== null) {
                    result0 = (function(offset, line, column) { return false;	})(pos0.offset, pos0.line, pos0.column);
                  }
                  if (result0 === null) {
                    pos = clone(pos0);
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      
      function parse_string() {
        var result0, result1, result2;
        var pos0, pos1;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.substr(pos.offset, 21) === "%%__STRING_TOKEN___%%") {
          result0 = "%%__STRING_TOKEN___%%";
          advance(pos, 21);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"%%__STRING_TOKEN___%%\"");
          }
        }
        if (result0 !== null) {
          if (/^[0-9]/.test(input.charAt(pos.offset))) {
            result2 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[0-9]");
            }
          }
          if (result2 !== null) {
            result1 = [];
            while (result2 !== null) {
              result1.push(result2);
              if (/^[0-9]/.test(input.charAt(pos.offset))) {
                result2 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("[0-9]");
                }
              }
            }
          } else {
            result1 = null;
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, d) {
        		return stringTokens[ d.join('') ];
        	})(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("String");
        }
        return result0;
      }
      
      function parse_html() {
        var result0, result1, result2;
        var pos0, pos1;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.substr(pos.offset, 19) === "%%__HTML_TOKEN___%%") {
          result0 = "%%__HTML_TOKEN___%%";
          advance(pos, 19);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"%%__HTML_TOKEN___%%\"");
          }
        }
        if (result0 !== null) {
          if (/^[0-9]/.test(input.charAt(pos.offset))) {
            result2 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[0-9]");
            }
          }
          if (result2 !== null) {
            result1 = [];
            while (result2 !== null) {
              result1.push(result2);
              if (/^[0-9]/.test(input.charAt(pos.offset))) {
                result2 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("[0-9]");
                }
              }
            }
          } else {
            result1 = null;
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, d) {
        		return stringTokens[ d.join('') ];
        	})(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("HTML");
        }
        return result0;
      }
      
      function parse_simpleString() {
        var result0, result1;
        var pos0;
        
        reportFailures++;
        pos0 = clone(pos);
        if (/^[a-zA-Z0-9$@#]/.test(input.charAt(pos.offset))) {
          result1 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z0-9$@#]");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[a-zA-Z0-9$@#]/.test(input.charAt(pos.offset))) {
              result1 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[a-zA-Z0-9$@#]");
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, simpleString) {
        		return simpleString.join('');
        	})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("SimpleString");
        }
        return result0;
      }
      
      function parse_number() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_int();
        if (result0 !== null) {
          result1 = parse_frac();
          if (result1 !== null) {
            result2 = parse_exp();
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, int_, frac, exp) { return parseFloat(int_ + frac + exp); })(pos0.offset, pos0.line, pos0.column, result0[0], result0[1], result0[2]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          result0 = parse_int();
          if (result0 !== null) {
            result1 = parse_frac();
            if (result1 !== null) {
              result2 = parse__();
              if (result2 !== null) {
                result0 = [result0, result1, result2];
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
          } else {
            result0 = null;
            pos = clone(pos1);
          }
          if (result0 !== null) {
            result0 = (function(offset, line, column, int_, frac) { return parseFloat(int_ + frac); })(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
          if (result0 === null) {
            pos0 = clone(pos);
            pos1 = clone(pos);
            result0 = parse_int();
            if (result0 !== null) {
              result1 = parse_exp();
              if (result1 !== null) {
                result2 = parse__();
                if (result2 !== null) {
                  result0 = [result0, result1, result2];
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
            if (result0 !== null) {
              result0 = (function(offset, line, column, int_, exp) { return parseFloat(int_ + exp); })(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
            }
            if (result0 === null) {
              pos = clone(pos0);
            }
            if (result0 === null) {
              pos0 = clone(pos);
              pos1 = clone(pos);
              result0 = parse_int();
              if (result0 !== null) {
                result1 = parse__();
                if (result1 !== null) {
                  result0 = [result0, result1];
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
              if (result0 !== null) {
                result0 = (function(offset, line, column, int_) { return parseFloat(int_); })(pos0.offset, pos0.line, pos0.column, result0[0]);
              }
              if (result0 === null) {
                pos = clone(pos0);
              }
            }
          }
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("number");
        }
        return result0;
      }
      
      function parse_int() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_digit19();
        if (result0 !== null) {
          result1 = parse_digits();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, digit19, digits) { return digit19 + digits; })(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          result0 = parse_digit();
          if (result0 === null) {
            pos0 = clone(pos);
            pos1 = clone(pos);
            if (input.charCodeAt(pos.offset) === 45) {
              result0 = "-";
              advance(pos, 1);
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"-\"");
              }
            }
            if (result0 !== null) {
              result1 = parse_digit19();
              if (result1 !== null) {
                result2 = parse_digits();
                if (result2 !== null) {
                  result0 = [result0, result1, result2];
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
            } else {
              result0 = null;
              pos = clone(pos1);
            }
            if (result0 !== null) {
              result0 = (function(offset, line, column, digit19, digits) { return "-" + digit19 + digits; })(pos0.offset, pos0.line, pos0.column, result0[1], result0[2]);
            }
            if (result0 === null) {
              pos = clone(pos0);
            }
            if (result0 === null) {
              pos0 = clone(pos);
              pos1 = clone(pos);
              if (input.charCodeAt(pos.offset) === 45) {
                result0 = "-";
                advance(pos, 1);
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"-\"");
                }
              }
              if (result0 !== null) {
                result1 = parse_digit();
                if (result1 !== null) {
                  result0 = [result0, result1];
                } else {
                  result0 = null;
                  pos = clone(pos1);
                }
              } else {
                result0 = null;
                pos = clone(pos1);
              }
              if (result0 !== null) {
                result0 = (function(offset, line, column, digit) { return "-" + digit;	})(pos0.offset, pos0.line, pos0.column, result0[1]);
              }
              if (result0 === null) {
                pos = clone(pos0);
              }
            }
          }
        }
        return result0;
      }
      
      function parse_frac() {
        var result0, result1;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 46) {
          result0 = ".";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\".\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_digits();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, digits) { return "." + digits; })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_exp() {
        var result0, result1;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_e();
        if (result0 !== null) {
          result1 = parse_digits();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, e, digits) { return e + digits; })(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_digits() {
        var result0, result1;
        var pos0;
        
        pos0 = clone(pos);
        result1 = parse_digit();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_digit();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, digits) { return digits.join(""); })(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_e() {
        var result0, result1;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (/^[eE]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[eE]");
          }
        }
        if (result0 !== null) {
          if (/^[+\-]/.test(input.charAt(pos.offset))) {
            result1 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[+\\-]");
            }
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos1);
          }
        } else {
          result0 = null;
          pos = clone(pos1);
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, e, sign) { return e + sign; })(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_digit() {
        var result0;
        
        if (/^[0-9]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[0-9]");
          }
        }
        return result0;
      }
      
      function parse_digit19() {
        var result0;
        
        if (/^[1-9]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[1-9]");
          }
        }
        return result0;
      }
      
      function parse_hexDigit() {
        var result0;
        
        if (/^[0-9a-fA-F]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[0-9a-fA-F]");
          }
        }
        return result0;
      }
      
      function parse__() {
        var result0, result1;
        
        reportFailures++;
        result0 = [];
        if (/^[ \t\n\r]/.test(input.charAt(pos.offset))) {
          result1 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[ \\t\\n\\r]");
          }
        }
        while (result1 !== null) {
          result0.push(result1);
          if (/^[ \t\n\r]/.test(input.charAt(pos.offset))) {
            result1 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[ \\t\\n\\r]");
            }
          }
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("whitespace");
        }
        return result0;
      }
      
      
      function cleanupExpected(expected) {
        expected.sort();
        
        var lastExpected = null;
        var cleanExpected = [];
        for (var i = 0; i < expected.length; i++) {
          if (expected[i] !== lastExpected) {
            cleanExpected.push(expected[i]);
            lastExpected = expected[i];
          }
        }
        return cleanExpected;
      }
      
      
      
      
      	var toString = {}.toString;
      	function deepCopyArray(arr) {
      		var out = [];
      		for (var i = 0, l = arr.length; i < l; ++i) {
      			out[i] = toString.call(arr[i]) === '[object Array]' ? deepCopyArray(arr[i]) : arr[i];
      		}
      		return out;
      	}
      
      	function escapeHTML(h) {
      		return String(h).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
      	}
      
      	// Replace all strings with recoverable string tokens:
      	// This is done to make comment-removal possible and safe.
      	var stringTokens = [];
      	function resolveStringToken(tok) {
      		return stringTokens[tok.substring('%%__STRING_TOKEN___%%'.length)]
      	}
      	input = input.replace(/(["'])((?:\\\1|[^\1])*?)\1/g, function($0, $1, $2) {
      		return '%%__STRING_TOKEN___%%' + (stringTokens.push(
      			$2.replace(/\\'/g, '\'').replace(/\\"/g, '"')
      		) - 1);
      	});
      	input = input.replace(/(^|\n)\s*\\([^\n\r]+)/g, function($0, $1, $2) {
      		return $1 + '%%__STRING_TOKEN___%%' + (stringTokens.push($2) - 1);
      	});
      
      	// Replace HTML with string tokens too
      	input = input.replace(/(`+)((?:\\\1|[^\1])*?)\1/g, function($0, $1, $2) {
      		return '%%__HTML_TOKEN___%%' + (stringTokens.push(
      			$2.replace(/\\`/g, '\`')
      		) - 1);
      	});
      
      	var isCurly = /\/\*\s*siml:curly=true\s*\*\//i.test(input);
      
      	// Remove comments:
      	input = input.replace(/\/\*[\s\S]*?\*\//g, '');
      	input = input.replace(/\/\/.+?(?=[\r\n])/g, '');
      
      	(function() {
      
      		// Avoid magical whitespace if we're definitely using curlies:
      		if (isCurly) {
      			return;
      		}
      
      		// Here we impose hierarchical curlies on the basis of indentation
      		// This is used to make, e.g.
      		// a\n\tb
      		// into
      		// a{b}
      
      		input = input.replace(/^(?:\s*\n)+/g, '');
      
      		var cur;
      		var lvl = 0;
      		var lines = [];
      		var blockedFromClosing = {};
      		var step = null;
      
      		var braceDepth = 0;
      		var curlyDepth = 0;
      
      		input = input.split(/[\r\n]+/);
      
      		for (var i = 0, l = input.length; i < l; ++i) {
      
      			var line = input[i];
      
      			var indent = line.match(/^\s*/)[0]; 
      			var indentLevel = (indent.match(/\s/g)||[]).length;
      
      			var nextIndentLevel = ((input[i+1] || '').match(/^\s*/)[0].match(/\s/g)||[]).length;
      
      			if (step == null && nextIndentLevel !== indentLevel) {
      				step = nextIndentLevel - indentLevel;
      			}
      
      			braceDepth += (line.match(/\(/g)||[]).length - (line.match(/\)/g)||[]).length;
      			curlyDepth += (line.match(/\{/g)||[]).length - (line.match(/\}/g)||[]).length;
      
      			if (/^\s*$/.test(line)) {
      				lines.push(line);
      				continue;
      			}
      
      			if (indentLevel < cur) { // dedent
      				var diff = cur - indentLevel;
      				while (1) {
      					diff -= step;
      					if (lvl === 0 || diff < 0) {
      						break;
      					}
      					if (blockedFromClosing[i-1]) {
      						continue;
      					}
      					lvl--;
      					lines[i-1] += '}';
      				}
      			}
      
      			if (curlyDepth || braceDepth) {
      				// Lines within a curly/brace nesting are blocked from future '}' closes
      				blockedFromClosing[i] = 1;
      				lines.push(line);
      				continue;
      			}
      
      			line = line.substring(indent.length);
      
      			// Don't seek to add curlies to places where curlies already exist:
      			if (/[{}]\s*$/.test(line)) {
      				lines.push(line);
      				continue;
      			}
      
      			if (nextIndentLevel > indentLevel) { // indent
      				lvl++; 
      				lines.push(indent + line + '{');
      			} else {
      				lines.push(indent+line);
      			}
      
      			cur = indentLevel;  
      
      		}
      
      		input = lines.join('\n'); //{{ // make curlies BALANCE for peg!
      		input += Array(lvl+1).join('}');
      	}());
      
      
      
      var result = parseFunctions[startRule]();
      
      /*
       * The parser is now in one of the following three states:
       *
       * 1. The parser successfully parsed the whole input.
       *
       *    - |result !== null|
       *    - |pos.offset === input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 2. The parser successfully parsed only a part of the input.
       *
       *    - |result !== null|
       *    - |pos.offset < input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 3. The parser did not successfully parse any part of the input.
       *
       *   - |result === null|
       *   - |pos.offset === 0|
       *   - |rightmostFailuresExpected| contains at least one failure
       *
       * All code following this comment (including called functions) must
       * handle these states.
       */
      if (result === null || pos.offset !== input.length) {
        var offset = Math.max(pos.offset, rightmostFailuresPos.offset);
        var found = offset < input.length ? input.charAt(offset) : null;
        var errorPosition = pos.offset > rightmostFailuresPos.offset ? pos : rightmostFailuresPos;
        
        throw new this.SyntaxError(
          cleanupExpected(rightmostFailuresExpected),
          found,
          offset,
          errorPosition.line,
          errorPosition.column
        );
      }
      
      return result;
    },
    
    /* Returns the parser source code. */
    toSource: function() { return this._source; }
  };
  
  /* Thrown when a parser encounters a syntax error. */
  
  result.SyntaxError = function(expected, found, offset, line, column) {
    function buildMessage(expected, found) {
      var expectedHumanized, foundHumanized;
      
      switch (expected.length) {
        case 0:
          expectedHumanized = "end of input";
          break;
        case 1:
          expectedHumanized = expected[0];
          break;
        default:
          expectedHumanized = expected.slice(0, expected.length - 1).join(", ")
            + " or "
            + expected[expected.length - 1];
      }
      
      foundHumanized = found ? quote(found) : "end of input";
      
      return "Expected " + expectedHumanized + " but " + foundHumanized + " found.";
    }
    
    this.name = "SyntaxError";
    this.expected = expected;
    this.found = found;
    this.message = buildMessage(expected, found);
    this.offset = offset;
    this.line = line;
    this.column = column;
  };
  
  result.SyntaxError.prototype = Error.prototype;
  
  return result;
})()
}());