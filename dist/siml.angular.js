/**
 * SIML (c) James Padolsey 2013
 * http://github.com/padolsey/SIML
 */
(function() {

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
			codeMatcher: null, // e.g. /<%.+?%>/g
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

			if (singleRunConfig.codeMatcher) {

				if (!singleRunConfig.curly) {
					throw new Error('SIML: Template-logic code matching (using codeMatcher) cannot occur unless config:curly is true');
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
			return input.replace(matcher, function($0) {
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

(function() {

	var INPUT_TYPES = {
		button: 1, checkbox: 1, color: 1, date: 1, datetime: 1, 'datetime-local': 1,
		email: 1, file: 1, hidden: 1, image: 1, month: 1, number: 1, password: 1, radio: 1,
		range: 1, reset: 1, search: 1, submit: 1, tel: 1, text: 1, time: 1, url: 1, week: 1
	};

	siml.html5 = new siml.Parser({
		pretty: true,
		indent: '	',
		directives: {
			doctype: {
				type: 'CONTENT',
				make: function() {
					return '<!doctype html>'
				}
			}
		},
		psuedos: {
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

	siml.html5.INPUT_TYPES = INPUT_TYPES;

}());


siml.angular = new siml.Parser({
	pretty: true,
	directives: {
		_default: {
			type: 'ATTR',
			make: function(name, value) {
				// camelCase -> snake-case
				name = name.replace(/([a-z])([A-Z])/g, function($0,$1,$2) {
					return $1 + '-' + $2.toLowerCase();
				});
				if (name.substring(0, 1) === '$') {
					name = name.substring(1);
				} else {
					name = 'ng-' + name;
				}
				return name + '="' + siml.Parser.escapeHTML(value) + '"';
			}
		}
	},
	psuedos: {
		_default: {
			type: 'ATTR',
			make: function(name) {
				if (this.parentElement.tag === 'input' && name in siml.html5.INPUT_TYPES) {
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
        "start": parse_start,
        "children": parse_children,
        "child": parse_child,
        "element": parse_element,
        "selector": parse_selector,
        "singleSelector": parse_singleSelector,
        "directive": parse_directive,
        "directiveName": parse_directiveName,
        "braced": parse_braced,
        "nonBraceCharacters": parse_nonBraceCharacters,
        "nonBraceCharacter": parse_nonBraceCharacter,
        "attributeName": parse_attributeName,
        "arrayElements": parse_arrayElements,
        "value": parse_value,
        "string": parse_string,
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
        "_": parse__,
        "whitespace": parse_whitespace
      };
      
      if (startRule !== undefined) {
        if (parseFunctions[startRule] === undefined) {
          throw new Error("Invalid rule name: " + quote(startRule) + ".");
        }
      } else {
        startRule = "start";
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
      
      function parse_start() {
        var result0;
        var pos0;
        
        pos0 = clone(pos);
        result0 = parse_children();
        if (result0 !== null) {
          result0 = (function(offset, line, column, children) {
        		return children;
        	})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_children() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        pos0 = clone(pos);
        result0 = [];
        pos1 = clone(pos);
        result1 = parse__();
        if (result1 !== null) {
          result2 = parse_child();
          if (result2 !== null) {
            result3 = parse__();
            if (result3 !== null) {
              if (input.charCodeAt(pos.offset) === 59) {
                result4 = ";";
                advance(pos, 1);
              } else {
                result4 = null;
                if (reportFailures === 0) {
                  matchFailed("\";\"");
                }
              }
              result4 = result4 !== null ? result4 : "";
              if (result4 !== null) {
                result1 = [result1, result2, result3, result4];
              } else {
                result1 = null;
                pos = clone(pos1);
              }
            } else {
              result1 = null;
              pos = clone(pos1);
            }
          } else {
            result1 = null;
            pos = clone(pos1);
          }
        } else {
          result1 = null;
          pos = clone(pos1);
        }
        while (result1 !== null) {
          result0.push(result1);
          pos1 = clone(pos);
          result1 = parse__();
          if (result1 !== null) {
            result2 = parse_child();
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                if (input.charCodeAt(pos.offset) === 59) {
                  result4 = ";";
                  advance(pos, 1);
                } else {
                  result4 = null;
                  if (reportFailures === 0) {
                    matchFailed("\";\"");
                  }
                }
                result4 = result4 !== null ? result4 : "";
                if (result4 !== null) {
                  result1 = [result1, result2, result3, result4];
                } else {
                  result1 = null;
                  pos = clone(pos1);
                }
              } else {
                result1 = null;
                pos = clone(pos1);
              }
            } else {
              result1 = null;
              pos = clone(pos1);
            }
          } else {
            result1 = null;
            pos = clone(pos1);
          }
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, all) {
        			var children = [];
        			for (var i = 0; i < all.length; i++) {
        				var name = all[i][1][0];
        				var value = all[i][1][1];
        				children.push([name, value]);
        			}
        			return children;
        		})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_child() {
        var result0, result1, result2, result3, result4, result5, result6;
        var pos0, pos1;
        
        pos0 = clone(pos);
        result0 = parse_string();
        if (result0 !== null) {
          result0 = (function(offset, line, column, s) {
        		return ['Directive', ['_fillText', s]];
        	})(pos0.offset, pos0.line, pos0.column, result0);
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
          		return ['Attribute', [name, value]];
          	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
          if (result0 === null) {
            pos0 = clone(pos);
            result0 = parse_element();
            if (result0 !== null) {
              result0 = (function(offset, line, column, el) {
            		return ['Element', el];
            	})(pos0.offset, pos0.line, pos0.column, result0);
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
                result0 = (function(offset, line, column, name, value) {
              		return ['Attribute', [name, value]];
              	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
              }
              if (result0 === null) {
                pos = clone(pos0);
              }
              if (result0 === null) {
                pos0 = clone(pos);
                result0 = parse_directive();
                if (result0 !== null) {
                  result0 = (function(offset, line, column, directive) {
                		return ['Directive', directive];
                	})(pos0.offset, pos0.line, pos0.column, result0);
                }
                if (result0 === null) {
                  pos = clone(pos0);
                }
              }
            }
          }
        }
        return result0;
      }
      
      function parse_element() {
        var result0, result1, result2, result3, result4, result5, result6, result7;
        var pos0, pos1;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_selector();
        if (result0 !== null) {
          result1 = parse__();
          if (result1 !== null) {
            if (input.charCodeAt(pos.offset) === 123) {
              result2 = "{";
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"{\"");
              }
            }
            if (result2 !== null) {
              result3 = parse__();
              if (result3 !== null) {
                if (input.charCodeAt(pos.offset) === 125) {
                  result4 = "}";
                  advance(pos, 1);
                } else {
                  result4 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"}\"");
                  }
                }
                if (result4 !== null) {
                  result5 = parse__();
                  if (result5 !== null) {
                    result0 = [result0, result1, result2, result3, result4, result5];
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
          result0 = (function(offset, line, column, selector) { return [selector]; })(pos0.offset, pos0.line, pos0.column, result0[0]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          result0 = parse_selector();
          if (result0 !== null) {
            result1 = parse__();
            if (result1 !== null) {
              if (input.charCodeAt(pos.offset) === 123) {
                result2 = "{";
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"{\"");
                }
              }
              if (result2 !== null) {
                result3 = parse__();
                if (result3 !== null) {
                  result4 = parse_children();
                  if (result4 !== null) {
                    result5 = parse__();
                    if (result5 !== null) {
                      if (input.charCodeAt(pos.offset) === 125) {
                        result6 = "}";
                        advance(pos, 1);
                      } else {
                        result6 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"}\"");
                        }
                      }
                      if (result6 !== null) {
                        result7 = parse__();
                        if (result7 !== null) {
                          result0 = [result0, result1, result2, result3, result4, result5, result6, result7];
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
            result0 = (function(offset, line, column, selector, children) { return [selector, children]; })(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
          if (result0 === null) {
            pos0 = clone(pos);
            pos1 = clone(pos);
            result0 = parse_selector();
            if (result0 !== null) {
              result1 = [];
              if (/^[s ]/.test(input.charAt(pos.offset))) {
                result2 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("[s ]");
                }
              }
              while (result2 !== null) {
                result1.push(result2);
                if (/^[s ]/.test(input.charAt(pos.offset))) {
                  result2 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("[s ]");
                  }
                }
              }
              if (result1 !== null) {
                result2 = parse_string();
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
              result0 = (function(offset, line, column, selector, text) { return [selector, [['Attribute', ['text', text]]]]; })(pos0.offset, pos0.line, pos0.column, result0[0], result0[2]);
            }
            if (result0 === null) {
              pos = clone(pos0);
            }
            if (result0 === null) {
              pos0 = clone(pos);
              pos1 = clone(pos);
              result0 = parse_selector();
              if (result0 !== null) {
                result1 = [];
                if (/^[s ]/.test(input.charAt(pos.offset))) {
                  result2 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("[s ]");
                  }
                }
                while (result2 !== null) {
                  result1.push(result2);
                  if (/^[s ]/.test(input.charAt(pos.offset))) {
                    result2 = input.charAt(pos.offset);
                    advance(pos, 1);
                  } else {
                    result2 = null;
                    if (reportFailures === 0) {
                      matchFailed("[s ]");
                    }
                  }
                }
                if (result1 !== null) {
                  result2 = parse_directive();
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
                result0 = (function(offset, line, column, selector, directive) {
              		return [ 
              			selector, [ ['Directive', directive] ]
              		]
              	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[2]);
              }
              if (result0 === null) {
                pos = clone(pos0);
              }
              if (result0 === null) {
                pos0 = clone(pos);
                pos1 = clone(pos);
                result0 = parse_selector();
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
                  result0 = (function(offset, line, column, selector) { return [selector]; })(pos0.offset, pos0.line, pos0.column, result0[0]);
                }
                if (result0 === null) {
                  pos = clone(pos0);
                }
              }
            }
          }
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("Element");
        }
        return result0;
      }
      
      function parse_selector() {
        var result0, result1, result2, result3, result4, result5;
        var pos0, pos1, pos2;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_singleSelector();
        if (result0 !== null) {
          result1 = [];
          pos2 = clone(pos);
          result2 = parse__();
          if (result2 !== null) {
            if (input.charCodeAt(pos.offset) === 62) {
              result3 = ">";
              advance(pos, 1);
            } else {
              result3 = null;
              if (reportFailures === 0) {
                matchFailed("\">\"");
              }
            }
            if (result3 !== null) {
              result4 = parse__();
              if (result4 !== null) {
                result5 = parse_singleSelector();
                if (result5 !== null) {
                  result2 = [result2, result3, result4, result5];
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
          } else {
            result2 = null;
            pos = clone(pos2);
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = clone(pos);
            result2 = parse__();
            if (result2 !== null) {
              if (input.charCodeAt(pos.offset) === 62) {
                result3 = ">";
                advance(pos, 1);
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\">\"");
                }
              }
              if (result3 !== null) {
                result4 = parse__();
                if (result4 !== null) {
                  result5 = parse_singleSelector();
                  if (result5 !== null) {
                    result2 = [result2, result3, result4, result5];
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
          result0 = (function(offset, line, column, s) {
        		var selector = s.join('').replace(/,/g, '').replace(/____STRING_TOKEN_____[0-9]+/g, function($0) {
        			// Save as string -- wrap in dQuotes, and escape inner dQuotes
        			return '"' + resolveStringToken($0).replace(/\\"/g, '"').replace(/"/g, '\\"') + '"';
        		}).replace(/[\r\n]+/g,''); // Remove breaks from multiline ATTR strings. TODO: Is this really needed?
        		return selector;
        	})(pos0.offset, pos0.line, pos0.column, result0);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("Selector");
        }
        return result0;
      }
      
      function parse_singleSelector() {
        var result0, result1;
        var pos0, pos1, pos2;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        pos2 = clone(pos);
        if (/^[^{}<>\n\t ]/.test(input.charAt(pos.offset))) {
          result1 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("[^{}<>\\n\\t ]");
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            if (/^[^{}<>\n\t ]/.test(input.charAt(pos.offset))) {
              result1 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[^{}<>\\n\\t ]");
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          if (input.substr(pos.offset, 2) === " :") {
            result1 = " :";
            advance(pos, 2);
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\" :\"");
            }
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = clone(pos2);
          }
        } else {
          result0 = null;
          pos = clone(pos2);
        }
        if (result0 !== null) {
          result1 = (function(offset, line, column, s) { 
          		s = s[0].join('') + s[1];
          		return /^(?:[a-z0-9-_]|[#.][a-z0-9-_$]|\[(?:\[[^\[\]]*\]|['"][^'"]*['"]|[^\[\]'"]+)+\]|:[a-z0-9]+)+\s*$/i.test(s);
          	})(pos.offset, pos.line, pos.column, result0) ? "" : null;
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
        		return s.join('');
        	})(pos0.offset, pos0.line, pos0.column, result0[0]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_directive() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_directiveName();
        if (result0 !== null) {
          if (input.charCodeAt(pos.offset) === 40) {
            result1 = "(";
            advance(pos, 1);
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"(\"");
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
          result0 = (function(offset, line, column, name) {
        		return [name];
        	})(pos0.offset, pos0.line, pos0.column, result0[0]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          result0 = parse_directiveName();
          if (result0 !== null) {
            if (input.charCodeAt(pos.offset) === 40) {
              result1 = "(";
              advance(pos, 1);
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"(\"");
              }
            }
            if (result1 !== null) {
              result2 = parse_arrayElements();
              if (result2 !== null) {
                if (input.charCodeAt(pos.offset) === 41) {
                  result3 = ")";
                  advance(pos, 1);
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("\")\"");
                  }
                }
                if (result3 !== null) {
                  result4 = parse__();
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
            result0 = (function(offset, line, column, name, args) {
          		return [name, args];
          	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[2]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
          if (result0 === null) {
            pos0 = clone(pos);
            pos1 = clone(pos);
            result0 = parse_directiveName();
            if (result0 !== null) {
              result1 = parse_braced();
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
              result0 = (function(offset, line, column, name, arg) {
            		return [name, [arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')]];
            	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[1]);
            }
            if (result0 === null) {
              pos = clone(pos0);
            }
          }
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("Directive");
        }
        return result0;
      }
      
      function parse_directiveName() {
        var result0, result1, result2;
        var pos0, pos1;
        
        reportFailures++;
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
          if (/^[a-zA-Z0-9$_]/.test(input.charAt(pos.offset))) {
            result2 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("[a-zA-Z0-9$_]");
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            if (/^[a-zA-Z0-9$_]/.test(input.charAt(pos.offset))) {
              result2 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("[a-zA-Z0-9$_]");
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
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("DirectiveName");
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
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("AttributeName");
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
        
        result0 = parse_string();
        if (result0 === null) {
          result0 = parse_simpleString();
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
        return result0;
      }
      
      function parse_string() {
        var result0, result1, result2;
        var pos0, pos1;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.substr(pos.offset, 21) === "____STRING_TOKEN_____") {
          result0 = "____STRING_TOKEN_____";
          advance(pos, 21);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"____STRING_TOKEN_____\"");
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
        result1 = parse_whitespace();
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_whitespace();
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("whitespace");
        }
        return result0;
      }
      
      function parse_whitespace() {
        var result0;
        
        if (/^[ \t\n\r]/.test(input.charAt(pos.offset))) {
          result0 = input.charAt(pos.offset);
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[ \\t\\n\\r]");
          }
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
      
      
      
      
      	// Replace all strings with recoverable string tokens:
      	// This is done to make comment-removal possible and safe.
      	var stringTokens = [];
      	function resolveStringToken(tok) {
      		return stringTokens[tok.substring('____STRING_TOKEN_____'.length)]
      	}
      	input = input.replace(/(["'])((?:\\\1|[^\1])*?)\1/g, function($0, $1, $2) {
      		return '____STRING_TOKEN_____' + (stringTokens.push(
      			$2.replace(/\\'/g, '\'').replace(/\\"/g, '"')
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
      		var step = null;
      
      		input = input.split(/[\r\n]+/);
      
      		for (var i = 0, l = input.length; i < l; ++i) {
      
      			var line = input[i];
      
      			var indent = line.match(/^\s*/)[0]; 
      			var indentLevel = (indent.match(/\s/g)||[]).length;
      
      			var nextIndentLevel = ((input[i+1] || '').match(/^\s*/)[0].match(/\s/g)||[]).length;
      
      			if (step == null) {
      				step = nextIndentLevel - indentLevel;
      			}
      
      			if (/^\s+$/.test(line)) {
      				lines.push(line);
      				continue;
      			}
      
      			// Test for a non selector at start of line:
      			if (!/^\s*[A-Za-z0-9-_#.]+\s*(?:>\s*[A-Za-z0-9-_#.]+)*/.test(line)) {
      				cur = indentLevel;
      				// Exit, we're not interested in attributes, directives [anything that's not a selector]
      				lines.push(line);
      				continue;
      			}
      
      			// Don't seek to add curlies to places where curlies already exist:
      			if (/[{}]\s*$/.test(line)) {
      				lines.push(line);
      				continue;
      			}
      
      			line = line.substring(indent.length);
      
      			if (indentLevel < cur) { // dedent
      				var diff = cur - indentLevel;
      				while (1) {
      					diff -= step;
      					if (lvl === 0 || diff < 0) {
      						break;
      					}
      					lvl--;
      					lines[i-1] += '}';
      				}
      			}
      
      			if (nextIndentLevel > indentLevel) { // indent
      				lvl++; 
      				lines.push(indent + line + '{');
      			} else {
      				lines.push(indent+line);
      			}
      
      			cur = indentLevel;  
      			 
      		}
      
      		input = lines.join('\n'); //{ // make curlies BALANCE for peg!
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