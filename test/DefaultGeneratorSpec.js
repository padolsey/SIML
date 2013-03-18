describe('DefaultParser: HTML Generation', function() {

	it('Should parse+convert basic schemas', function() {
		expect('a').toGenerate('<a></a>');
		expect('a { id: "foo" }').toGenerate('<a id="foo"></a>');
		expect('a>b').toGenerate('<a><b></b></a>');
		expect('x { a b c d }').toGenerate('<x><a><b><c><d></d></c></b></a></x>');
		expect('a {id:1;href:"http://foo.com";target:"blah"}').toGenerate('<a id="1" href="http://foo.com" target="blah"></a>');
	});

	describe('Siblings & Descendants', function() {
		it('Handles sibling+descendant combos correctly', function() {
			expect('a>b{c}d').toGenerate('<a><b><c></c></b></a><d></d>');
			expect('a:2{b>c}').toGenerate('<a><b><c></c></b></a><a><b><c></c></b></a>');
			expect('a+b{c} d').toGenerate('<a></a><b><c></c></b><d></d>');
			expect('a>b>c+d>e').toGenerate('<a><b><c></c><d><e></e></d></b></a>');
			expect('a b c + d > p + x').toGenerate('<a><b><c></c><d><p></p><x></x></d></b></a>');
			expect('f>(s{"SIML"} "is" a)').toGenerate('<f><s>SIML</s>is<a></a></f>');
		});
		describe('Descendant combinator', function() {
			it('Should be able to handle them', function() {
				expect('a > b').toGenerate('<a><b></b></a>');
				expect('a > b > c').toGenerate('<a><b><c></c></b></a>');
				expect('a>b > c   >d').toGenerate('<a><b><c><d></d></c></b></a>');
				expect('div > ul { li > a { href:"foo" }}').toGenerate('<div><ul><li><a href="foo"></a></li></ul></div>');
			});
		});
	});

	describe('Text', function() {
		it('Should be able to parse+convert quoted text', function() {
			expect('t "foo"').toGenerate('<t>foo</t>');
			expect("t 'foo'").toGenerate('<t>foo</t>');
			expect('t { "This" "is" "Sparta" }').toGenerate('<t>ThisisSparta</t>');
			expect('foo { "Look: " span "HERE!" }').toGenerate('<foo>Look: <span>HERE!</span></foo>');
			expect('foo { "Look: " span{} "HERE!" }').toGenerate('<foo>Look: <span></span>HERE!</foo>');
			expect('a "b" c "d"').toGenerate('<a>b<c>d</c></a>');
			expect('   a { @_fillText("foo"); @_fillText("baz"); "  " em }  ').toGenerate('<a>foobaz  <em></em></a>');
		});
	});

	describe('ExclusiveGroups `(x,y/t)` shortcut', function() {
		describe('Following Series', function() {
			it('Should be able to parse uses correctly', function() {
				expect('t (b/c)').toGenerate('<t><b></b></t><t><c></c></t>');
				expect('t (b>a/c)').toGenerate('<t><b><a></a></b></t><t><c></c></t>');
				expect('t (a.klass/a#id)').toGenerate('<t><a class="klass"></a></t><t><a id="id"></a></t>');
				expect('t{ b (x/z) }').toGenerate('<t><b><x></x></b><b><z></z></b></t>');
				expect('body (b/a b)').toGenerate('<body><b></b></body><body><a><b></b></a></body>');
				expect('a (b, (c/d))').toGenerate('<a><b></b><c></c></a><a><b></b><d></d></a>');
				expect('a>b>c>(x/y)').toGenerate('<a><b><c><x></x></c><c><y></y></c></b></a>');
				expect('a>b>c>(x,y)').toGenerate('<a><b><c><x></x><y></y></c></b></a>');
				expect('ul li ("foo"/"blah"/"bam"/"whoa")').toGenerate('<ul><li>foo</li><li>blah</li><li>bam</li><li>whoa</li></ul>')
			});
		});
		describe('Preceeding Series', function() {
			it('Should be able to parse uses correctly', function() {
				expect('body (b/a b) "txt"').toGenerate('<body><b>txt</b></body><body><a><b>txt</b></a></body>');
				expect('t (a.klass/a#id)+j').toGenerate('<t><a class="klass"></a><j></j></t><t><a id="id"></a><j></j></t>');
				expect('a (b, (c/d)) "eggs"').toGenerate('<a><b></b><c>eggs</c></a><a><b></b><d>eggs</d></a>');
				expect('((b/c) x) t').toGenerate('<b><x><t></t></x></b><c><x><t></t></x></c>');
				expect('((a))').toGenerate('<a></a>');
				expect('(a{id:blah;}/b[id=foo]).same').toGenerate('<a class="same" id="blah"></a><b class="same" id="foo"></b>');
				expect('((a/b)/(c/d))x').toGenerate('<a><x></x></a><b><x></x></b><c><x></x></c><d><x></x></d>');
				expect('(a/B)"foo"').toGenerate('<a>foo</a><B>foo</B>');
			});
		});
		describe('Deeper test cases', function() {
			it('Should be able to parse correctly', function() {
				expect('t (a m+q/a)+j').toGenerate('<t><a><m></m><q></q><j></j></a></t><t><a></a><j></j></t>');
				expect('\
					section+(X/Y(diva/divb)) {\n\
						h1(a/span)em[id=foo]\n\
						(body)(a)(href:foo;)\
					}\
				').toGenerate([
					'<section></section>',
					'<X>',
						'<h1><a><em id="foo"></em></a></h1>',
						'<h1><span><em id="foo"></em></span></h1>',
						'<body><a href="foo"></a></body>',
					'</X>',
					'<section></section>',
					'<Y>',
						'<diva>',
							'<h1><a><em id="foo"></em></a></h1>',
							'<h1><span><em id="foo"></em></span></h1>',
							'<body><a href="foo"></a></body>',
						'</diva>',
					'</Y>',
					'<Y>',
						'<divb>',
							'<h1><a><em id="foo"></em></a></h1>',
							'<h1><span><em id="foo"></em></span></h1>',
							'<body><a href="foo"></a></body>',
						'</divb>',
					'</Y>'
				].join(''));
			});
		});
	});

	describe('Attributes', function() {
		it('Should be able to parse attributes in the form x:Number|String', function() {
			expect('a{a:1;}').toGenerate('<a a="1"></a>');
			expect('a{a: 1}').toGenerate('<a a="1"></a>');
			expect('a{a:"1"}').toGenerate('<a a="1"></a>');
			expect('a{a: "1";}').toGenerate('<a a="1"></a>');
			expect('a{a:1}').toGenerate('<a><a></a></a>'); // CONSIDERED A PSEUDO !! 
			expect('\
				section {\n\
					a:y; // optional semi-colon (used for differentiating it from pseudo classes)\n\
					b: 2\n\
					c:"9999" d:9847; href:\'http://foo.com\'\n\
				}\
			').toGenerate('<section a="y" b="2" c="9999" d="9847" href="http://foo.com"></section>');
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
				expect('t#foo#abc').toGenerate('<t id="abc"></t>'); // take MOST RECENT
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

	describe('Nesting', function() {
		it('Should be able to handle various levels of nesting', function() {
			expect('a{b{c{d{e{f{g{h{i}}}}}}}}').toGenerate('<a><b><c><d><e><f><g><h><i></i></h></g></f></e></d></c></b></a>');
			expect('\
				section {\
					id: 123;\
					header {\
						h1 > em { text: "FooBar" }\
						id : 456;\
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
		it('Should handle inner braces and curlies by ignoring them and content within', function() {
			expect('\
				body\n\
					a\n\
						b {\n\
							// These should be considered equal indentation since they\'re within curlies\n\
							c\n\
								e\n\
									f\n\
						}\n\
						p {\n\
				e\n\
			u\n\
						}\n\
						m\n\
							xp {a:123;}\n\
								lp#a.g {b:123;}\n\
						a(\n\
							a/\n\
								b/\n\
								c\n\
						)\n\
			').toGenerate([
				'<body>',
					'<a>',
						'<b>',
							'<c></c>',
							'<e></e>',
							'<f></f>',
						'</b>',
						'<p>',
							'<e></e>',
							'<u></u>',
						'</p>',
						'<m>',
							'<xp a="123"></xp>',
							'<lp id="a" class="g" b="123"></lp>',
							'<a>',
								'<a></a>',
							'</a>',
							'<a>',
								'<b></b>',
							'</a>',
							'<a>',
								'<c></c>',
							'</a>',
						'</m>',
					'</a>',
				'</body>'
			].join(''));
		});
		it('Should handle inner-brace case #2', function() {
			expect('\
html\n\
    head\n\
        meta\n\
        title\n\
    body\n\
        section\n\
            h1 \'ok\'\n\
        p (\n\
            \'a\'/\'b\'\n\
        )\n\
			').toGenerate([
				'<html>',
					'<head>',
						'<meta/>',
						'<title></title>',
					'</head>',
					'<body>',
						'<section>',
							'<h1>ok</h1>',
						'</section>',
						'<p>a</p>',
						'<p>b</p>',
					'</body>',
				'</html>'
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
							em span br\n\
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
							'<em><span><br/></span></em>',
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