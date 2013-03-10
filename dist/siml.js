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

			var html = [];

			for (var i = 0, l = spec.length; i < l; ++i) {
				var type = spec[i][0];
				html[i] = new Parser[type](
					spec[i][1],
					singleRunConfig
				).html;
			}

			return html.join(singleRunConfig.pretty ? '\n' : '')
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
        "singleLineChildren": parse_singleLineChildren,
        "child": parse_child,
        "groupedElement": parse_groupedElement,
        "element": parse_element,
        "elementRHSChildren": parse_elementRHSChildren,
        "singleSelector": parse_singleSelector,
        "selectorRepeatableComponent": parse_selectorRepeatableComponent,
        "selectorTag": parse_selectorTag,
        "selectorId": parse_selectorId,
        "selectorClass": parse_selectorClass,
        "selectorAttr": parse_selectorAttr,
        "selectorPseudo": parse_selectorPseudo,
        "selectorAttrValue": parse_selectorAttrValue,
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
        				if (name === 'Group') {
        					children.push.apply(children, value);
        					continue;
        				}
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
      
      function parse_singleLineChildren() {
        var result0, result1, result2, result3, result4, result5;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        result1 = parse_child();
        if (result1 !== null) {
          result2 = [];
          if (/^[\t ]/.test(input.charAt(pos.offset))) {
            result3 = input.charAt(pos.offset);
            advance(pos, 1);
          } else {
            result3 = null;
            if (reportFailures === 0) {
              matchFailed("[\\t ]");
            }
          }
          while (result3 !== null) {
            result2.push(result3);
            if (/^[\t ]/.test(input.charAt(pos.offset))) {
              result3 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result3 = null;
              if (reportFailures === 0) {
                matchFailed("[\\t ]");
              }
            }
          }
          if (result2 !== null) {
            if (input.charCodeAt(pos.offset) === 43) {
              result3 = "+";
              advance(pos, 1);
            } else {
              result3 = null;
              if (reportFailures === 0) {
                matchFailed("\"+\"");
              }
            }
            result3 = result3 !== null ? result3 : "";
            if (result3 !== null) {
              result4 = [];
              if (/^[\t ]/.test(input.charAt(pos.offset))) {
                result5 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result5 = null;
                if (reportFailures === 0) {
                  matchFailed("[\\t ]");
                }
              }
              while (result5 !== null) {
                result4.push(result5);
                if (/^[\t ]/.test(input.charAt(pos.offset))) {
                  result5 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result5 = null;
                  if (reportFailures === 0) {
                    matchFailed("[\\t ]");
                  }
                }
              }
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
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            pos1 = clone(pos);
            result1 = parse_child();
            if (result1 !== null) {
              result2 = [];
              if (/^[\t ]/.test(input.charAt(pos.offset))) {
                result3 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("[\\t ]");
                }
              }
              while (result3 !== null) {
                result2.push(result3);
                if (/^[\t ]/.test(input.charAt(pos.offset))) {
                  result3 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("[\\t ]");
                  }
                }
              }
              if (result2 !== null) {
                if (input.charCodeAt(pos.offset) === 43) {
                  result3 = "+";
                  advance(pos, 1);
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"+\"");
                  }
                }
                result3 = result3 !== null ? result3 : "";
                if (result3 !== null) {
                  result4 = [];
                  if (/^[\t ]/.test(input.charAt(pos.offset))) {
                    result5 = input.charAt(pos.offset);
                    advance(pos, 1);
                  } else {
                    result5 = null;
                    if (reportFailures === 0) {
                      matchFailed("[\\t ]");
                    }
                  }
                  while (result5 !== null) {
                    result4.push(result5);
                    if (/^[\t ]/.test(input.charAt(pos.offset))) {
                      result5 = input.charAt(pos.offset);
                      advance(pos, 1);
                    } else {
                      result5 = null;
                      if (reportFailures === 0) {
                        matchFailed("[\\t ]");
                      }
                    }
                  }
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
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, line, column, all) {
        			var children = [];
        			for (var i = 0; i < all.length; i++) {
        				var name = all[i][0][0];
        				var value = all[i][0][1];
        				if (name === 'Group') {
        					children.push.apply(children, value);
        					continue;
        				}
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
            		return ['Attribute', [name, value]];
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
                if (result0 === null) {
                  pos0 = clone(pos);
                  result0 = parse_groupedElement();
                  if (result0 !== null) {
                    result0 = (function(offset, line, column, els) {
                  		if (els[0] === 'Element') {
                  			els = [ els ];
                  		} else if (els[0] === 'Group') {
                  			els = els[1];
                  		}
                  		return ['Group', els];
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
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      
      function parse_groupedElement() {
        var result0, result1, result2, result3, result4, result5, result6, result7, result8, result9, result10;
        var pos0, pos1, pos2;
        
        reportFailures++;
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
            result2 = parse_groupedElement();
            if (result2 !== null) {
              result3 = [];
              pos2 = clone(pos);
              result4 = parse__();
              if (result4 !== null) {
                if (input.charCodeAt(pos.offset) === 44) {
                  result5 = ",";
                  advance(pos, 1);
                } else {
                  result5 = null;
                  if (reportFailures === 0) {
                    matchFailed("\",\"");
                  }
                }
                if (result5 !== null) {
                  result6 = parse__();
                  if (result6 !== null) {
                    result7 = parse_groupedElement();
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
                  if (input.charCodeAt(pos.offset) === 44) {
                    result5 = ",";
                    advance(pos, 1);
                  } else {
                    result5 = null;
                    if (reportFailures === 0) {
                      matchFailed("\",\"");
                    }
                  }
                  if (result5 !== null) {
                    result6 = parse__();
                    if (result6 !== null) {
                      result7 = parse_groupedElement();
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
                    result6 = parse__();
                    if (result6 !== null) {
                      result7 = [];
                      result8 = parse_selectorRepeatableComponent();
                      while (result8 !== null) {
                        result7.push(result8);
                        result8 = parse_selectorRepeatableComponent();
                      }
                      if (result7 !== null) {
                        result8 = parse_elementRHSChildren();
                        if (result8 === null) {
                          pos2 = clone(pos);
                          if (input.charCodeAt(pos.offset) === 62) {
                            result8 = ">";
                            advance(pos, 1);
                          } else {
                            result8 = null;
                            if (reportFailures === 0) {
                              matchFailed("\">\"");
                            }
                          }
                          result8 = result8 !== null ? result8 : "";
                          if (result8 !== null) {
                            result9 = parse__();
                            if (result9 !== null) {
                              result10 = parse_child();
                              if (result10 !== null) {
                                result8 = [result8, result9, result10];
                              } else {
                                result8 = null;
                                pos = clone(pos2);
                              }
                            } else {
                              result8 = null;
                              pos = clone(pos2);
                            }
                          } else {
                            result8 = null;
                            pos = clone(pos2);
                          }
                        }
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
          result0 = (function(offset, line, column, first, rest, mergeSelector, mergeChildren) {
        
        		function collectTargets(element) {
        			var targets = [];
        			var children = element[1][1];
        			for (var i = 0, l = children.length; i < l; ++i) {
        				var child = children[i];
        				if (child[0] === 'Element') {
        					targets.push( collectTargets(child) || child );
        				}
        			}
        			return targets.length ? targets : null;
        		}
        
        		var els = [];
        		rest.unshift([,,,first]);
        
        		var subjectChildren = [];
        
        		for (var el, elGroupChildren, firstEl, i = 0, l = rest.length; i < l; ++i) {
        
        			el = rest[i][3];
        
        			elGroupChildren = el[0] === 'Group' ? el[1] : [el];
        			firstEl = elGroupChildren[0];
        
        			for (var targets, e = elGroupChildren.length; e--;) {
        				targets = collectTargets(elGroupChildren[e]);
        				subjectChildren.push.apply(subjectChildren, targets || [elGroupChildren[e]]);
        			}
        			els.push.apply(els, elGroupChildren);
        
        		}
        
        		if (mergeChildren[2] && typeof mergeChildren[2][0] == 'string') { // Is From single-end-child expr
        			mergeChildren = mergeChildren[2];
        			mergeChildren = mergeChildren[0] == 'Group' ? mergeChildren[1] : [mergeChildren];
        		}
        
        		for (var s = subjectChildren.length; s--;) {
        			mergeChildren = deepCopyArray(mergeChildren);
        			//mergeSelector = deepCopyArray(mergeSelector); // TODO: is needed?
        			if (mergeSelector.length) {
        				subjectChildren[s][1][0].push.apply(subjectChildren[s][1][0], mergeSelector);
        			}
        			if (mergeChildren.length) {
        				subjectChildren[s][1][1].push.apply(subjectChildren[s][1][1], mergeChildren);
        			}
        		}
        
        		return ['Group', els];
        	})(pos0.offset, pos0.line, pos0.column, result0[2], result0[3], result0[7], result0[8]);
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
        }
        reportFailures--;
        if (reportFailures === 0 && result0 === null) {
          matchFailed("GroupedElement");
        }
        return result0;
      }
      
      function parse_element() {
        var result0, result1, result2, result3, result4, result5, result6, result7, result8;
        var pos0, pos1, pos2, pos3;
        
        reportFailures++;
        pos0 = clone(pos);
        pos1 = clone(pos);
        result0 = parse_singleSelector();
        if (result0 !== null) {
          result1 = parse__();
          if (result1 !== null) {
            result2 = parse_elementRHSChildren();
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
          result0 = (function(offset, line, column, selector, children) { return [selector, children]; })(pos0.offset, pos0.line, pos0.column, result0[0], result0[2]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
          pos0 = clone(pos);
          pos1 = clone(pos);
          pos2 = clone(pos);
          result1 = parse_singleSelector();
          if (result1 !== null) {
            result2 = [];
            if (/^[ \t]/.test(input.charAt(pos.offset))) {
              result3 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result3 = null;
              if (reportFailures === 0) {
                matchFailed("[ \\t]");
              }
            }
            while (result3 !== null) {
              result2.push(result3);
              if (/^[ \t]/.test(input.charAt(pos.offset))) {
                result3 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("[ \\t]");
                }
              }
            }
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
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                result4 = [];
                if (/^[ \t]/.test(input.charAt(pos.offset))) {
                  result5 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result5 = null;
                  if (reportFailures === 0) {
                    matchFailed("[ \\t]");
                  }
                }
                while (result5 !== null) {
                  result4.push(result5);
                  if (/^[ \t]/.test(input.charAt(pos.offset))) {
                    result5 = input.charAt(pos.offset);
                    advance(pos, 1);
                  } else {
                    result5 = null;
                    if (reportFailures === 0) {
                      matchFailed("[ \\t]");
                    }
                  }
                }
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
          if (result1 !== null) {
            result0 = [];
            while (result1 !== null) {
              result0.push(result1);
              pos2 = clone(pos);
              result1 = parse_singleSelector();
              if (result1 !== null) {
                result2 = [];
                if (/^[ \t]/.test(input.charAt(pos.offset))) {
                  result3 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("[ \\t]");
                  }
                }
                while (result3 !== null) {
                  result2.push(result3);
                  if (/^[ \t]/.test(input.charAt(pos.offset))) {
                    result3 = input.charAt(pos.offset);
                    advance(pos, 1);
                  } else {
                    result3 = null;
                    if (reportFailures === 0) {
                      matchFailed("[ \\t]");
                    }
                  }
                }
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
                  result3 = result3 !== null ? result3 : "";
                  if (result3 !== null) {
                    result4 = [];
                    if (/^[ \t]/.test(input.charAt(pos.offset))) {
                      result5 = input.charAt(pos.offset);
                      advance(pos, 1);
                    } else {
                      result5 = null;
                      if (reportFailures === 0) {
                        matchFailed("[ \\t]");
                      }
                    }
                    while (result5 !== null) {
                      result4.push(result5);
                      if (/^[ \t]/.test(input.charAt(pos.offset))) {
                        result5 = input.charAt(pos.offset);
                        advance(pos, 1);
                      } else {
                        result5 = null;
                        if (reportFailures === 0) {
                          matchFailed("[ \\t]");
                        }
                      }
                    }
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
            }
          } else {
            result0 = null;
          }
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
                        pos2 = clone(pos);
                        reportFailures++;
                        pos3 = clone(pos);
                        result7 = parse__();
                        if (result7 !== null) {
                          if (input.charCodeAt(pos.offset) === 43) {
                            result8 = "+";
                            advance(pos, 1);
                          } else {
                            result8 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"+\"");
                            }
                          }
                          if (result8 !== null) {
                            result7 = [result7, result8];
                          } else {
                            result7 = null;
                            pos = clone(pos3);
                          }
                        } else {
                          result7 = null;
                          pos = clone(pos3);
                        }
                        reportFailures--;
                        if (result7 === null) {
                          result7 = "";
                        } else {
                          result7 = null;
                          pos = clone(pos2);
                        }
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
            result0 = (function(offset, line, column, selectors, children) {
          		// Ensure that 'a b {c} d' consider 'a b {c}' as one el definition
          		// and 'd' as another. Otherwise we get probs like a{b}d, with d
          		// being a child of b.
          		// BUT (notice the !'+') still allow a{b}+c{d} (a>b,c>d)
          		var cur;
          		var root = cur = [selectors.shift()[0], []];
          		for (var i = 0, l = selectors.length; i < l; ++i) {
          			cur[1].push([
          				'Element', cur = [selectors[i][0], []]
          			]);
          		}
          		cur[1] = children;
          		return root;
          	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
          if (result0 === null) {
            pos0 = clone(pos);
            pos1 = clone(pos);
            result0 = parse_singleSelector();
            if (result0 !== null) {
              result1 = [];
              if (/^[\t >]/.test(input.charAt(pos.offset))) {
                result2 = input.charAt(pos.offset);
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("[\\t >]");
                }
              }
              while (result2 !== null) {
                result1.push(result2);
                if (/^[\t >]/.test(input.charAt(pos.offset))) {
                  result2 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("[\\t >]");
                  }
                }
              }
              if (result1 !== null) {
                result2 = parse_singleLineChildren();
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
              result0 = (function(offset, line, column, selector, c) { return [selector, c]; })(pos0.offset, pos0.line, pos0.column, result0[0], result0[2]);
            }
            if (result0 === null) {
              pos = clone(pos0);
            }
            if (result0 === null) {
              pos0 = clone(pos);
              pos1 = clone(pos);
              result0 = parse_singleSelector();
              if (result0 !== null) {
                result1 = [];
                if (/^[\t ]/.test(input.charAt(pos.offset))) {
                  result2 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("[\\t ]");
                  }
                }
                while (result2 !== null) {
                  result1.push(result2);
                  if (/^[\t ]/.test(input.charAt(pos.offset))) {
                    result2 = input.charAt(pos.offset);
                    advance(pos, 1);
                  } else {
                    result2 = null;
                    if (reportFailures === 0) {
                      matchFailed("[\\t ]");
                    }
                  }
                }
                if (result1 !== null) {
                  result2 = parse_string();
                  if (result2 !== null) {
                    result3 = [];
                    if (/^[\t ]/.test(input.charAt(pos.offset))) {
                      result4 = input.charAt(pos.offset);
                      advance(pos, 1);
                    } else {
                      result4 = null;
                      if (reportFailures === 0) {
                        matchFailed("[\\t ]");
                      }
                    }
                    while (result4 !== null) {
                      result3.push(result4);
                      if (/^[\t ]/.test(input.charAt(pos.offset))) {
                        result4 = input.charAt(pos.offset);
                        advance(pos, 1);
                      } else {
                        result4 = null;
                        if (reportFailures === 0) {
                          matchFailed("[\\t ]");
                        }
                      }
                    }
                    if (result3 !== null) {
                      result4 = parse_element();
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
                result0 = (function(offset, line, column, selector, text, el) {
              		var children = [['Attribute', ['text', text]], ['Element', el]];
              		return [selector, children];
              	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[2], result0[4]);
              }
              if (result0 === null) {
                pos = clone(pos0);
              }
              if (result0 === null) {
                pos0 = clone(pos);
                pos1 = clone(pos);
                result0 = parse_singleSelector();
                if (result0 !== null) {
                  result1 = [];
                  if (/^[\t ]/.test(input.charAt(pos.offset))) {
                    result2 = input.charAt(pos.offset);
                    advance(pos, 1);
                  } else {
                    result2 = null;
                    if (reportFailures === 0) {
                      matchFailed("[\\t ]");
                    }
                  }
                  while (result2 !== null) {
                    result1.push(result2);
                    if (/^[\t ]/.test(input.charAt(pos.offset))) {
                      result2 = input.charAt(pos.offset);
                      advance(pos, 1);
                    } else {
                      result2 = null;
                      if (reportFailures === 0) {
                        matchFailed("[\\t ]");
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
                  result0 = parse_singleSelector();
                  if (result0 !== null) {
                    result0 = (function(offset, line, column, selector) { return [selector, []]; })(pos0.offset, pos0.line, pos0.column, result0);
                  }
                  if (result0 === null) {
                    pos = clone(pos0);
                  }
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
      
      function parse_elementRHSChildren() {
        var result0, result1, result2, result3, result4, result5, result6;
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
          result1 = parse__();
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
          result0 = (function(offset, line, column) { return []; })(pos0.offset, pos0.line, pos0.column);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
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
            result1 = parse__();
            if (result1 !== null) {
              result2 = parse_children();
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
                      if (input.charCodeAt(pos.offset) === 43) {
                        result6 = "+";
                        advance(pos, 1);
                      } else {
                        result6 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"+\"");
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
            result0 = (function(offset, line, column, children) { return children; })(pos0.offset, pos0.line, pos0.column, result0[2]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
          if (result0 === null) {
            pos0 = clone(pos);
            pos1 = clone(pos);
            result0 = parse_string();
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
              result0 = (function(offset, line, column, text, children) {
            		children.unshift(['Attribute', ['text', text]]);
            		return children;
            	})(pos0.offset, pos0.line, pos0.column, result0[0], result0[4]);
            }
            if (result0 === null) {
              pos = clone(pos0);
            }
            if (result0 === null) {
              pos0 = clone(pos);
              if (input.charCodeAt(pos.offset) === 43) {
                result0 = "+";
                advance(pos, 1);
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"+\"");
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
            }
          }
        }
        return result0;
      }
      
      function parse_singleSelector() {
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
        
        result0 = parse_selectorId();
        if (result0 === null) {
          result0 = parse_selectorClass();
          if (result0 === null) {
            result0 = parse_selectorPseudo();
            if (result0 === null) {
              result0 = parse_selectorAttr();
            }
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
      
      function parse_selectorId() {
        var result0, result1, result2;
        var pos0, pos1;
        
        pos0 = clone(pos);
        pos1 = clone(pos);
        if (input.charCodeAt(pos.offset) === 35) {
          result0 = "#";
          advance(pos, 1);
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"#\"");
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
          result0 = (function(offset, line, column, t) { return ['Id', t.join('')]; })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_selectorClass() {
        var result0, result1, result2;
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
          result0 = (function(offset, line, column, t) { return ['Class', t.join('')]; })(pos0.offset, pos0.line, pos0.column, result0[1]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        return result0;
      }
      
      function parse_selectorAttr() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        
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
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                if (input.charCodeAt(pos.offset) === 93) {
                  result4 = "]";
                  advance(pos, 1);
                } else {
                  result4 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"]\"");
                  }
                }
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
        		return ['Attr', [name.join(''), value]];
        	})(pos0.offset, pos0.line, pos0.column, result0[1], result0[3]);
        }
        if (result0 === null) {
          pos = clone(pos0);
        }
        if (result0 === null) {
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
            if (/^[^[\]]/.test(input.charAt(pos.offset))) {
              result2 = input.charAt(pos.offset);
              advance(pos, 1);
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("[^[\\]]");
              }
            }
            if (result2 !== null) {
              result1 = [];
              while (result2 !== null) {
                result1.push(result2);
                if (/^[^[\]]/.test(input.charAt(pos.offset))) {
                  result2 = input.charAt(pos.offset);
                  advance(pos, 1);
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("[^[\\]]");
                  }
                }
              }
            } else {
              result1 = null;
            }
            if (result1 !== null) {
              if (input.charCodeAt(pos.offset) === 93) {
                result2 = "]";
                advance(pos, 1);
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"]\"");
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
          		return ['Attr', [name.join('')]];
          	})(pos0.offset, pos0.line, pos0.column, result0[1]);
          }
          if (result0 === null) {
            pos = clone(pos0);
          }
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
        			arg && arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')
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
      
      function parse_directive() {
        var result0, result1, result2, result3;
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
      
      
      
      
      	var toString = {}.toString;
      	function deepCopyArray(arr) {
      		var out = [];
      		for (var i = 0, l = arr.length; i < l; ++i) {
      			out[i] = toString.call(arr[i]) === '[object Array]' ? deepCopyArray(arr[i]) : arr[i];
      		}
      		return out;
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