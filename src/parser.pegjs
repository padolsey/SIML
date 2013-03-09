/* SIML parser [uses peg.js] */

/**
 * Pre-processing of the string occurs BEFORE parsing: 
 * (Removing comments & doing tabs->curlies)
 */
{

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
} 

/**
 * THE ACTUAL PARSER
 */

start
	= children:children {
		return children;
	}

children
	= all:(_ child _ ";"?)* {
			var children = [];
			for (var i = 0; i < all.length; i++) {
				var name = all[i][1][0];
				var value = all[i][1][1];
				children.push([name, value]);
			}
			return children;
		}

singleLineChildren
	= all:(child [\t ]* '+'? [\t ]*)+ {
			var children = [];
			for (var i = 0; i < all.length; i++) {
				var name = all[i][0][0];
				var value = all[i][0][1];
				children.push([name, value]);
			}
			return children;
		}

/**
 * CHILD TYPES
 */

child
	= s:string {
		return ['Directive', ['_fillText', s]];
	}
	/ name:attributeName _ ":" _ value:value _ ";" {
		return ['Attribute', [name, value]];
	}
	/ name:attributeName _ ":" _ value:string {
		return ['Attribute', [name, value]];
	}
	/ name:attributeName _ ":" [ \t] value:value { // explicit space
		return ['Attribute', [name, value]];
	}
	/ directive:directive {
		return ['Directive', directive];
	}
	/ el:element {
		return ['Element', el];
	}
	/ name:attributeName _ ":" _ value:value {
		return ['Attribute', [name, value]];
	}

/**
 * Elements
 */
element "Element"
	= selector:selector _ "{" _ "}" { return [selector]; }
	/ selector:selector _ "+" { return [selector]; }
	/ selector:selector _ "{" _ children:children _ "}" { return [selector, children]; }
	/ selectors:(selector [ \t>]+)+ _ "{" _ children:children _ "}" {
		var cur;
		var root = cur = [selectors.shift()[0], []];
		for (var i = 0, l = selectors.length; i < l; ++i) {
			cur[1].push([
				'Element', cur = [selectors[i][0], []]
			]);
		}
		cur[1] = children;
		return root;
	}
	/ selector:selector [\t ]* text:string _ "{" _ children:children _ "}" {
		children.unshift(['Attribute', ['text', text]]);
		return [selector, children];
	}
	/ selector:selector [\t >]* c:singleLineChildren { return [selector, c]; }
	/ selector:selector [\t ]* text:string [\t ]* el:element {
		var children = [['Attribute', ['text', text]], ['Element', el]];
		return [selector, children];
	}
	/ selector:selector [\t ]* text:string { return [selector, [['Attribute', ['text', text]]]]; }
	/ selector:selector { return [selector]; }

/**
 * Selector
 */
selector "Selector"
	= singleSelector

singleSelector
	= s:(selectorTag selectorRepeatableComponent*) {
		s[1].unshift(s[0]);
		return s[1];
	}
	/ s:selectorRepeatableComponent+ {
		return s;
	}

selectorRepeatableComponent 
	= selectorId
	/ selectorClass
	/ selectorPseudo
	/ selectorAttr

selectorTag
	= t:[a-z0-9_-]i+ { return ['Tag', t.join('')]; }

selectorId
	= '#' t:[a-z0-9-_$]i+ { return ['Id', t.join('')]; }

selectorClass
	= '.' t:[a-z0-9-_$]i+ { return ['Class', t.join('')]; }

selectorAttr
	= '[' name:[^\[\]=]+ '=' value:selectorAttrValue? ']' {
		return ['Attr', [name.join(''), value]];
	}
	/ '[' name:[^\[\]]+ ']' {
		return ['Attr', [name.join('')]];
	}

selectorPseudo
	= ':' !string t:[a-z0-9-_$]i+ arg:braced?  {
		return ['Pseudo', [
			t.join(''),
			arg && arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')
		]];
	}

selectorAttrValue
	= v:string { return v; }
	/ v:[^\[\]]+ { return v.join(''); }

/**
 * Directives &  Attributes
 */
directive "Directive"
	= name:directiveName "(" ")" {
		return [name];
	}
	/ name:directiveName "(" args:arrayElements ")" {
		return [name, args];
	}
	/ name:directiveName arg:braced {
		return [name, [arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')]];
	}

directiveName "DirectiveName"
	= a:[a-zA-Z_$] b:[a-zA-Z0-9$_]* { return a+b.join(''); }

braced
  = "(" parts:(braced / nonBraceCharacter)* ")" {
      return '(' + parts.join('') + ')';
    }

nonBraceCharacters
  = chars:nonBraceCharacter+ { return chars.join(''); }

nonBraceCharacter
  = [^()]

attributeName "AttributeName"
	= name:[A-Za-z0-9-_]+ { return name.join(''); }
	/ string


/*** JSON-LIKE TYPES ***/
/*** (c) Copyright (c) 2010-2012 David Majda ***/
/*** FROM: https://github.com/dmajda/pegjs/blob/master/examples/json.pegjs ***/
arrayElements
	= head:value tail:("," _ value)* {
			var result = [head];
			for (var i = 0; i < tail.length; i++) {
				result.push(tail[i][2]);
			}
			return result;
		}

value
	= string
	/ simpleString
	/ number
	/ "true" _	{ return true;	 }
	/ "false" _ { return false;	}

/* ===== Lexical Elements ===== */

string "String"
	= '____STRING_TOKEN_____' d:[0-9]+ {
		return stringTokens[ d.join('') ];
	}

simpleString "SimpleString"
	= simpleString:[a-zA-Z0-9$@#]+ {
		return simpleString.join('');
	}

number "number"
	= int_:int frac:frac exp:exp _ { return parseFloat(int_ + frac + exp); }
	/ int_:int frac:frac _ { return parseFloat(int_ + frac); }
	/ int_:int exp:exp _ { return parseFloat(int_ + exp); }
	/ int_:int _ { return parseFloat(int_); }

int
	= digit19:digit19 digits:digits { return digit19 + digits; }
	/ digit:digit
	/ "-" digit19:digit19 digits:digits { return "-" + digit19 + digits; }
	/ "-" digit:digit { return "-" + digit;	}

frac
	= "." digits:digits { return "." + digits; }

exp
	= e:e digits:digits { return e + digits; }

digits
	= digits:digit+ { return digits.join(""); }

e
	= e:[eE] sign:[+-]? { return e + sign; }

digit
	= [0-9]

digit19
	= [1-9]

hexDigit
	= [0-9a-fA-F]

/* ===== Whitespace ===== */

_ "whitespace"
	= whitespace*

whitespace
	= [ \t\n\r]
