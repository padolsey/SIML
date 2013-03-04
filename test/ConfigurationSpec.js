describe('Configuration', function() {
	describe('config:pretty', function() {
		it('Prints HTML using the passed method of indentation', function() {
			expect(siml.parse('\
				section {\
					id: 123\
					header {\
						h1 > em { text: "FooBar" }\
						id : 456\
					}\
					div.foo {\
						span > a {\
							strong { text: \'ok\' }\
							em\
						}\
					}\
				}\
			', { pretty: true, indent: '___:' })).toBe([
				'<section id="123">',
				'___:<header id="456">',
				'___:___:<h1>',
				'___:___:___:<em>',
				'___:___:___:___:FooBar',
				'___:___:___:</em>',
				'___:___:</h1>',
				'___:</header>',
				'___:<div class="foo">',
				'___:___:<span>',
				'___:___:___:<a>',
				'___:___:___:___:<strong>',
				'___:___:___:___:___:ok',
				'___:___:___:___:</strong>',
				'___:___:___:___:<em></em>',
				'___:___:___:</a>',
				'___:___:</span>',
				'___:</div>',
				'</section>'
			].join('\n'));
		});
	});
	describe('config:curly', function() {
		it('Does attempt magical whitespace when curly is undefined/false [default]', function() {
			expect(siml.parse('\
				a\n\
					b\n\
					c\n\
						d\n\
					e\n\
				f\n\
			', {pretty:false})).toBe([
				'<a>',
					'<b></b>',
					'<c>',
						'<d></d>',
					'</c>',
					'<e></e>',
				'</a>',
				'<f></f>'
			].join(''));
			expect(siml.parse('\
				a\n\
					b\n\
					c { // curly here, even though the rest of the doc is tabbed \n\
						d\n\
					}\n\
					e\n\
				f\n\
			', {pretty:false})).toBe([
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
		it('Does not attempt magical whitespace when curly is true', function() {
			expect(siml.parse('\
				a\n\
					b\n\
					c {\n\
						d\n\
					}\n\
					e\n\
				f\n\
			', {pretty:false,curly:true})).toBe([
				// In this case it has assumed a structure of: 'a b c{d} e f':
				'<a></a>',
				'<b></b>',
				'<c>',
					'<d></d>',
				'</c>',
				'<e></e>',
				'<f></f>'
			].join(''));
		});
	});
	describe('config:codeMatcher [Nested code]', function() {
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
				', {codeMatcher:'<%[\\s\\S]+?%>', curly: true, pretty: false})).toBe([
					'<body>',
						'<% for (var i in obj[foo]) { %>',
							'<section class="a"><foo>Text</foo></section>',
						'<% } // end that %>',
					'</body>'
				].join(''));
			});
		});
		describe('Custom Template logic delimiters', function() {
			var codeMatcher = '~:[\\s\\S]+?:~'; // template logic delimiters
			describe('With curlies', function() {
				it('Should retain template logic in the output', function() {
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
					', {codeMatcher:codeMatcher, curly: true, pretty: false})).toBe([
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
			/*describe('With magical whitespace', function() {
				it('Should retain template logic in the output', function() {
					expect(siml.parse('\
						section#a.b\n\
							~: for (var i = 0, l = this.fn().length; i < l; ++i) { :~\n\
								header\n\
									h1\n\
										~:\n\
											data.title() || data.getRealTitle() ~~ \'LOL THIS CODE...\'\n\
											;\n\
											// Testing\n\
											1,2,3({a,c,d});\n\
										:~\n\
						~:CodeAtWrongTab??:~\n\
	~:CodeAtWrongTab??:~\n\
									h2 \n\
										id: \'a\'\n\
										class: \'b foo d\'\n\
							~: } :~\n\
							~:...:~\n\
							body ~:=TheBodyContent:~\n\
					', {codeMatcher:codeMatcher, curly: false, pretty: false})).toBe([
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
							'~:...:~',
							'<body>',
								'~:=TheBodyContent:~',
							'</body>',
						'</section>'
					].join(''));
				});
			});*/
		});
	});
});