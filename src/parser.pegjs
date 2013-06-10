/* SIML parser [uses peg.js] */

/**
 * Pre-processing of the string occurs BEFORE parsing: 
 * (Removing comments & doing tabs->curlies)
 */
{

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
	var stringTokens = [
		// [ 'QUOTE', 'ACTUAL_STRING' ] ...
	];
	function resolveStringToken(tok) {
		return stringTokens[tok.substring('%%__STRING_TOKEN___%%'.length)]
	}

	// Replace HTML with string tokens first
	input = input.replace(/(`+)((?:\\\1|[^\1])*?)\1/g, function($0, $1, $2) {
		return '%%__HTML_TOKEN___%%' + (stringTokens.push(
			[$1, $2.replace(/\\`/g, '\`')]
		) - 1);
	});

	input = input.replace(/(["'])((?:\\\1|[^\1])*?)\1/g, function($0, $1, $2) {
		return '%%__STRING_TOKEN___%%' + (stringTokens.push(
			[$1, $2.replace(/\\'/g, '\'').replace(/\\"/g, '"')]
		) - 1);
	});

	input = input.replace(/(^|\n)\s*\\([^\n\r]+)/g, function($0, $1, $2) {
		return $1 + '%%__STRING_TOKEN___%%' + (stringTokens.push([$1, $2]) - 1);
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

} 

/**
 * THE ACTUAL PARSER
 */

start
	= MSeries

/**
 * MSeries -- A multiline series of LSeries
 */
MSeries
	= _ head:CSeries? body:([\r\n\t ]* CSeries)* _ {
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
	}

/**
 * CSeries -- A comma series of LSeries
 */
CSeries
	= a:LSeries b:(_ ',' _ CSeries)? {
		if (b[3]) {
			return ['IncGroup', [a, b[3]], 'CommaGroup']; 
		}
		return a;
	}

/**
 * LSeries --  A single line series of Singles
 */
LSeries
	= singleA:Single tail:([> \t+]* LSeries)? _ decl:ChildrenDeclaration? {

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
	}
	/ '(' _ head:MSeries body:(_ '/' _ MSeries)* _ ')' selector:selectorRepeatableComponent* _ tail:ExcGroupRHS?  {

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
	}

ExcGroupRHS
	= ChildrenDeclaration
	/ separator:[> \t+]* tail:LSeries {
		return [tail, separator];
	}

ChildrenDeclaration
	= '{' c:MSeries? '}' {
		return ['Declaration', [c]];
	}

/**
 * Single -- A single simple component, such as an Element or Attribute
 */ 
Single
	= Attribute
	/ PrototypeDefinition
	/ Element
	/ Text
	/ HTML
	/ Directive

/**
 * Element
 */
Element
	= s:Selector {
		return ['Element', [s,[]]];
	}

/**
 * PrototypeDefinition
 */
PrototypeDefinition
	= name:PrototypeName [ \t]* '=' [ \t]* s:SingleSelector [ \t]* ';'? {
		return ['Prototype', [name, s]];
	}

PrototypeName
	= a:[a-zA-Z_$] b:[a-zA-Z0-9$_-]* { return a+b.join(''); }

/**
 * Selector
 */
Selector "Selector"
	= SingleSelector

SingleSelector
	= s:(selectorTag selectorRepeatableComponent*) {
		s[1].unshift(s[0]);
		return s[1];
	}
	/ s:selectorRepeatableComponent+ {
		return s;
	}

selectorRepeatableComponent 
	= selectorIdClass
	/ selectorPseudo
	/ selectorAttr

selectorTag
	= t:[a-z0-9_-]i+ { return ['Tag', t.join('')]; }

selectorIdClass
	= f:[#.] t:[a-z0-9-_$]i+ {
		return [
			f === '#'  ? 'Id' : 'Class',
			t.join('')
		];
	}

selectorAttr
	= '[' name:[^\[\]=]+ value:('=' selectorAttrValue)? ']' {
		return ['Attr', [name.join(''), value.length ? value[1] : null]];
	}

selectorPseudo
	= ':' !string t:[a-z0-9-_$]i+ arg:braced?  {
		return ['Pseudo', [
			t.join(''),
			[
				arg && arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')
			]
		]];
	}

selectorAttrValue
	= v:string { return v; }
	/ v:[^\[\]]+ { return v.join(''); }

/**
 * Text
 */
Text
	= s:string {
		return ['Directive', ['_fillHTML', [escapeHTML(s)], []]];
	}

/**
 * HTML
 */
HTML
	= s:html {
		return ['Directive', ['_fillHTML', [s], []]];
	}

/**
 * Attribute
 */
Attribute
	= name:attributeName _ ":" _ value:value _ ";" {
		return ['Attribute', [name, [value]]];
	}
	/ name:attributeName _ ":" _ value:string {
		return ['Attribute', [name, [escapeHTML(value)]]];
	}
	/ name:attributeName _ ":" _ value:html {
		return ['Attribute', [name, [value]]];
	}
	/ name:attributeName _ ":" [ \t] value:value { // explicit space
		return ['Attribute', [name, [value]]];
	}

attributeName "AttributeName"
	= name:[A-Za-z0-9-_]+ { return name.join(''); }
	/ string
	/ html

/**
 * Directive
 */
Directive "Directive"
	= name:DirectiveName args:DirectiveArguments? children:DirectiveChildren? {
		return ['Directive', [
			name,
			args || [],
			children || []
		]];
	}

DirectiveName
	= '@' a:[a-zA-Z_$] b:[a-zA-Z0-9$_]* { return a+b.join(''); }

DirectiveArguments
	= "(" args:arrayElements? ")" {
		return args;
	}
	/ arg:braced {
		return [
			arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')
		];
	}

DirectiveChildren
	= ';' {
		return [];
	}
	/ _ '{' c:MSeries? '}' {
		return [c];
	}
	/ [> \t]* tail:LSeries {
		return [tail];
	}

braced
  = "(" parts:(braced / nonBraceCharacter)* ")" {
      return '(' + parts.join('') + ')';
    }

nonBraceCharacters
  = chars:nonBraceCharacter+ { return chars.join(''); }

nonBraceCharacter
  = [^()]


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
	= s:string {
		return escapeHTML(s);
	}
	/ simpleString
	/ html
	/ number
	/ "true" _	{ return true;	 }
	/ "false" _ { return false;	}

/* ===== Lexical Elements ===== */

string "String"
	= '%%__STRING_TOKEN___%%' d:[0-9]+ {
		// Replace any `...` quotes within the String:
		return stringTokens[ d.join('') ][1].replace(/%%__HTML_TOKEN___%%(\d+)/g, function(_, $1) {
			var str = stringTokens[ $1 ];
			return str[0] + str[1] + str[0];
		});
	}

html "HTML"
	= '%%__HTML_TOKEN___%%' d:[0-9]+ {
		return stringTokens[ d.join('') ][1];
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
	= [ \t\n\r]*
