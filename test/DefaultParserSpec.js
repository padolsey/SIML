describe('DefaultParser: HTML Generation', function() {

	it('Should parse+convert basic schemas', function() {
		expect('a').toGenerate('<a></a>');
		expect('a { id: "foo" }').toGenerate('<a id="foo"></a>');
		expect('a>b').toGenerate('<a><b></b></a>');
		expect('x { a b c d }').toGenerate('<x><a></a><b></b><c></c><d></d></x>');
		expect('a {id:1;href:"http://foo.com";target:"blah"}').toGenerate('<a id="1" href="http://foo.com" target="blah"></a>');
	});

	describe('Descendant combinator', function() {
		it('Should be able to handle them', function() {
			expect('a > b').toGenerate('<a><b></b></a>');
			expect('a > b > c').toGenerate('<a><b><c></c></b></a>');
			expect('a>b > c   >d').toGenerate('<a><b><c><d></d></c></b></a>');
			expect('div > ul { li > a { href:"foo" }}').toGenerate('<div><ul><li><a href="foo"></a></li></ul></div>');
		});
	});

	describe('Text', function() {
		it('Should be able to parse+convert quoted text', function() {
			expect('t "foo"').toGenerate('<t>foo</t>');
			expect("t 'foo'").toGenerate('<t>foo</t>');
			expect('t { "This" "is" "Sparta" }').toGenerate('<t>ThisisSparta</t>');
			expect('foo { "Look: " span "HERE!" }').toGenerate('<foo>Look: <span>HERE!</span></foo>');
			expect('foo { "Look: " span{} "HERE!" }').toGenerate('<foo>Look: <span></span>HERE!</foo>');
			expect('a "b" c "d"').toGenerate('<a>b</a><c>d</c>');
			expect('   a { _fillText("foo") _fillText("baz") "  " em }  ').toGenerate('<a>foobaz  <em></em></a>');
		});
	});

	describe('Selector Support', function()	{
		describe('When I do not specify a tag', function() {
			it('Should use DIV as default', function() {
				expect('#foo').toGenerate('<div id="foo"></div>');
				expect('.foo').toGenerate('<div class="foo"></div>');
				expect('em > #a.b').toGenerate('<em><div id="a" class="b"></div></em>');
			});
		});
		describe('When using a.b#c (In various orders)', function() {
			it('Should generate correctly', function() {
				expect('t#foo').toGenerate('<t id="foo"></t>');
				expect('#foo').toGenerate('<div id="foo"></div>');
				expect('t#foo.baz').toGenerate('<t id="foo" class="baz"></t>');
				expect('t#foo#abc').toGenerate('<t id="foo"></t>'); // take FIRST
				expect('t.a.b.c.d#e').toGenerate('<t id="e" class="a b c d"></t>');
			});
		});
		describe('Attribute selectors [abc=def]', function() {
			describe('Various different attribute selectors', function()  {
				it('Should parse correctly', function() {
					expect('a[foo=1]').toGenerate('<a foo="1"></a>');
					expect('a[foo=abc]').toGenerate('<a foo="abc"></a>');
					expect('a[b=ThisIsABitLonger]').toGenerate('<a b="ThisIsABitLonger"></a>');
					expect('a[b="c"][d=e][f=\'g\']').toGenerate('<a b="c" d="e" f="g"></a>');
				});
			});
		});
	});

	describe('Nested code', function() {
		describe('When template logic in the form <%...%> exists in input', function() {
			it('Should retain it in the output', function() {
				expect(siml.parse('\
					body {\
						<% for (var i in obj[foo]) { %>\
							section.a {\
								foo "Text"\
							}\
						<% } // end that %>\
					}\
				', {codeMatcher:/<%[\s\S]+?%>/g, curly: true, pretty: false})).toBe([
					'<body>',
						'<% for (var i in obj[foo]) { %>',
							'<section class="a"><foo>Text</foo></section>',
						'<% } // end that %>',
					'</body>'
				].join(''));
			});
		});
		describe('Custom Template logic delimiters', function() {
			it('Should retain them in the output', function() {
				// Tabbing:
				expect(siml.parse('\
					section#a.b {\n\
						~: for (var i = 0, l = this.fn().length; i < l; ++i) { :~\n\
							header {\n\
								h1 {\n\
									~:\n\
										data.title() || data.getRealTitle() ~~ \'LOL THIS CODE...\'\n\
										;\n\
										// Testing\n\
										1,2,3({a,c,d});\n\
									:~\n\
					~:CodeAtWrongTab??:~\n\
~:CodeAtWrongTab??:~\n\
								}\n\
								h2 {\n\
									id: \'a\'\n\
									class: \'b foo d\'\n\
								}\n\
							}\n\
						~: } :~\n\
						~:/* This is just a comment */:~\n\
						body ~:=TheBodyContent:~\n\
					}\n\
				', {codeMatcher:/~:[\s\S]+?:~/g, curly: true, pretty: false})).toBe([
					'<section id="a" class="b">',
						'~: for (var i = 0, l = this.fn().length; i < l; ++i) { :~',
							'<header>',
								'<h1>',
									'~:\n\
										data.title() || data.getRealTitle() ~~ \'LOL THIS CODE...\'\n\
										;\n\
										// Testing\n\
										1,2,3({a,c,d});\n\
									:~',
								'~:CodeAtWrongTab??:~',
								'~:CodeAtWrongTab??:~',
								'</h1>',
								'<h2 id="a" class="b foo d"></h2>',
							'</header>',
						 '~: } :~',
						'~:/* This is just a comment */:~',
						'<body>',
							'~:=TheBodyContent:~',
						'</body>',
					'</section>'
				].join(''));
			});
		});
	});

	describe('Nesting', function() {
		it('Should be able to handle various levels of nesting', function() {
			expect('a{b{c{d{e{f{g{h{i}}}}}}}}').toGenerate('<a><b><c><d><e><f><g><h><i></i></h></g></f></e></d></c></b></a>');
			expect('\
				section {\
					id: 123\
					header {\
						h1 > em { text: "FooBar" }\
						id : 456\
					}\
					div.foo {\
						span > a > strong { text: \'ok\' }\
					}\
				}\
			').toGenerate([
				'<section id="123">',
					'<header id="456">',
						'<h1><em>FooBar</em></h1>',
					'</header>',
					'<div class="foo">',
						'<span>',
							'<a><strong>ok</strong></a>',
						'</span>',
					'</div>',
				'</section>'
			].join(''));
		});
	});

	describe('Significant whitespace', function() {
		it('Should be able to create a hierarchy from indentation instead of curlies', function() {
			expect('\
				a\n\
					b\n\
					c\n\
						d\n\
					e\n\
				f\n\
			').toGenerate([
				'<a>',
					'<b></b>',
					'<c>',
						'<d></d>',
					'</c>',
					'<e></e>',
				'</a>',
				'<f></f>'
			].join(''));
		});
		it('Should handle fillText directives correctly', function() {
			expect('\
				body\n\
				    "a"\n\
				    "b"\n\
				    section\n\
				    "c"\n\
				    "d"\n\
			').toGenerate([
				'<body>',
					'ab<section></section>cd',
				'</body>'
			].join(''));
		});
		it('Should handle a large document correctly', function() {
			expect('\
				html\n\
					head\n\
						meta\n\
							charset: \'utf-8\'\n\
						title \'Testing Testing \\\' ok\'\n\
					body   \n\
						section.foo#t[tab-index=1] \n\
							ul > li\n\
								\'A mixture of tabs and curlies!??\'\n\
						footer\n\
							br\n\
							br br br\n\
							br\n\
							div\n\
								div > strong > em \n\
									id: \'anEM\'			\n\
									input			\n\
										type: "checkbox"\n\
			').toGenerate([
				'<html>',
					'<head>',
						'<meta charset="utf-8"/>',
						'<title>Testing Testing \' ok</title>',
					'</head>',
					'<body>',
						'<section id="t" class="foo" tab-index="1">',
							'<ul><li>A mixture of tabs and curlies!??</li></ul>',
						'</section>',
						'<footer>',
							'<br/>',
							'<br/>',
							'<br/>',
							'<br/>',
							'<br/>',
							'<div>',
								'<div><strong><em id="anEM">',
									'<input type="checkbox"/>',
								'</em></strong></div>',
							'</div>',
						'</footer>',
					'</body>',
				'</html>'
			].join(''));
		});
	});

});