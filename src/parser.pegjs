/* SIML parser [uses peg.js] */

/**
 * Pre-processing of the string occurs BEFORE parsing: 
 * (Removing comments & doing tabs->curlies)
 */
{

	var toString = {}.toString;
	var push = [].push;

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

	//var EOF = '%%__EOF__%%';
	//input += '%%__EOF__%%';

} 

/**
 * THE ACTUAL PARSER
 */

start
	= _ children:children _ {
		return children;
	}

children
	= all:(_ siblingChild/child _)* {
			var children = [];
			for (var i = 0; i < all.length; i++) {
				var name = all[i][1][0];
				var value = all[i][1][1];
				if (name === 'Group') {
					push.apply(children, value);
					continue;
				}
				if (name === 'DeclaredElement') {
					name = 'Element';
				}
				children.push([name, value]);
			}
			return children;
		}

/**
 * CHILD TYPES
 */

 siblingChild
	= head:child cSibling:(_'+'_ siblingChild)? {
		var g = ['Group', [
			head
		]];
		if (cSibling.length) {
			cSibling = cSibling[3];
			if (cSibling[0] == 'Group') { 
				push.apply(g[1], cSibling[1]);
			} else {
				g[1].push(cSibling[3]);
			}
		}
		return g;
	}

child
	= s:string {
		return ['Directive', ['_fillText', s]];
	}
	/ head:element body:( (_','_) (elementWithDeclaredChildren/element) )+ {

			var elements = [];

			body.unshift([,head]);

			var source = body.pop()[1];

			for (var i = 0; i < body.length; i++) {

				var name = body[i][1][0];
				var value = body[i][1][1];

				if (name === 'Group') {
					push.apply(elements, value);
					continue;
				}

				elements.push([name, value]);

			}

			console.warn(source);

			var mergeChildren;

			if (source && (source[0] === 'DeclaredElement'  || source[0] === 'Group')) {

				if (source[0] === 'Group') {
					mergeChildren = source[2];
				} else {
					source[0] = 'Element';
					mergeChildren = source[1][1];
				}

				for (var i = 0; i < elements.length; i++) {
				console.warn('Merging', mergeChildren.toString(), 'into', elements[i].toString());
					push.apply(elements[i][1][1], mergeChildren);
				}
			}

			if (source[0] === 'Group') {
				push.apply(elements, source[1]);
			} else {
				elements.push(source);
			}

			return elements;
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
	/ elementWithDeclaredChildren
	/ element
	/ name:attributeName _ ":" _ value:value {
		return ['Attribute', [name, value]];
	}

elementWithDeclaredChildren
	= selector:selector _ children:elementRHSChildren { return ['DeclaredElement', [selector, children]]; }

/**
 * Elements
 */
element "Element"
	= els:groupedElement {
		return els;
	}
	/*/ selectors:(selector [ \t]* '>'? [ \t]*)+ _ "{" _ children:children _ "}" !(_ '+') {
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
		return ['Element', root];
	}*/
	/ selector:selector [\t >]* c:child/siblingChild {
		var children = c[0] == 'Group' ? c[1] : [c];
		return ['Element', [selector, children]];
	}
	/ selector:selector [\t ]* text:string [\t ]* el:element {
		var children = [['Attribute', ['text', text]], el];
		return ['Element', [selector, children]];
	}
	/ selector:selector [\t ]* text:string {
		return ['Element',
			[selector, [
				['Attribute', ['text', text]]
			]]
		];
	}
	/ selector:selector { return ['Element', [selector, []]]; }

elementRHSChildren
	= "{" _ "}" { return []; }
	/ "{" _ children:children _ "}" { return children; }
	/ text:string _ "{" _ children:children _ "}" {
		children.unshift(['Attribute', ['text', text]]);
		return children;
	}

groupedElement "GroupedElement"
	= '(' _ first:element rest:(_ ',' _ element)* _ ')' _ mergeSelector:selectorRepeatableComponent* mergeChildren:(elementRHSChildren/('>'? _ child))? {

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
				push.apply(subjectChildren, targets || [elGroupChildren[e]]);
			}
			push.apply(els, elGroupChildren);

		}

		if (mergeChildren[2] && typeof mergeChildren[2][0] == 'string') { // Is From single-end-child expr
			mergeChildren = mergeChildren[2];
			mergeChildren = mergeChildren[0] == 'Group' ? mergeChildren[1] : [mergeChildren];
		}

		for (var s = subjectChildren.length; s--;) {
			mergeChildren = deepCopyArray(mergeChildren);
			//mergeSelector = deepCopyArray(mergeSelector); // TODO: is needed?
			if (mergeSelector.length) {
				push.apply(subjectChildren[s][1][0], mergeSelector);
			}
			if (mergeChildren.length) {
				push.apply(subjectChildren[s][1][1], mergeChildren);
			}
		}

		return ['Group', els, mergeChildren];
	}

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
	= '@' name:directiveName "(" ")" {
		return [name];
	}
	/ '@' name:directiveName "(" args:arrayElements ")" {
		return [name, args];
	}
	/ '@' name:directiveName arg:braced {
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
