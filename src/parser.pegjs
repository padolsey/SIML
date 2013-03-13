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

	// Remove comments:
	input = input.replace(/\/\*[\s\S]*?\*\//g, '');
	input = input.replace(/\/\/.+?(?=[\r\n])/g, '');

	console.warn(input);

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
	= _ head:LSeries body:([\r\n] _ LSeries)* _ {
		var all = [];
		body.unshift([,,head]);
		for (var i = 0, l = body.length; i < l; ++i) {
			all.push( body[i][2] );
		}
		return ['IncGroup', all];
	}

/**
 * LSeries --  A single line series of Singles
 */
LSeries
	= a:Single sep:[> \t+]* b:LSeries {
		switch (a[0]) {
			case 'Element': {

				if (a[1][2] && a[1][2].declared) {
					sep = '+';
				}

				if (sep.indexOf('+') > -1) {
					return ['IncGroup', [a,b]];
				}

				// a>b
				if (a[0] === 'Element') {
					a[1][1].push(b); 
				} else if (a[0] === 'IncGroup' || a[0] === 'ExcGroup') {
					a[1].push(b);
				}

				return a;
			}
			case 'Directive': {
				return ['IncGroup', [a, b]];
			}
		}
		console.warn(':::', a, b)
		return 'ERROR';
	}
	/ Single

/**
 * Single -- A single simple component, such as an Element or Attribute
 */ 
Single
	= Attribute
	/ '(' _ head:Single body:(_ '/' _ Single)* _ ')' sep:[> \t+]* tail:Single? {
		var all = [];
		body.unshift([,,,head]);
		for (var i = 0, l = body.length; i < l; ++i) {
			all.push(body[i][3]);
		}
		return ['ExcGroup', all, tail];
	}
	/ Element
	/ Text
	/ Directive


/**
 * Element
 */
Element
	= s:Selector _ '{' m:MSeries '}' {
		return ['Element', [
			s,
			[m],
			{declared:1}
		]]
	}
	/ s:Selector _ '{' _ '}' {
		return ['Element',
			[s, [], {declared:1}]
		];
	}
	/ s:Selector {
		return ['Element', [s, []]];
	}

/**
 * Selector
 */
Selector "Selector"
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
 * Text
 */
Text
	= s:string {
		return ['Directive', ['_fillText', s]];
	}

/**
 * Attribute
 */
Attribute
	= name:attributeName _ ":" _ value:value _ ";" {
		return ['Attribute', [name, value]];
	}
	/ name:attributeName _ ":" _ value:string {
		return ['Attribute', [name, value]];
	}
	/ name:attributeName _ ":" [ \t] value:value { // explicit space
		return ['Attribute', [name, value]];
	}

attributeName "AttributeName"
	= name:[A-Za-z0-9-_]+ { return name.join(''); }
	/ string

/**
 * Directive
 */
Directive "Directive"
	= name:directiveName "(" ")" {
		return ['Directive', [name]];
	}
	/ name:directiveName "(" args:arrayElements ")" {
		return ['Directive', [name, args]];
	}
	/ name:directiveName arg:braced {
		return [
			'Directive',
			[name, [
				arg.substr(1, arg.length-2).replace(/[\s\r\n]+/g, ' ').replace(/^\s\s*|\s\s*$/g, '')
			]]
		];
	}

directiveName "DirectiveName"
	= '@' a:[a-zA-Z_$] b:[a-zA-Z0-9$_]* { return a+b.join(''); }

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
	= string
	/ simpleString
	/ number
	/ "true" _	{ return true;	 }
	/ "false" _ { return false;	}

/* ===== Lexical Elements ===== */

string "String"
	= '%%__STRING_TOKEN___%%' d:[0-9]+ {
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
