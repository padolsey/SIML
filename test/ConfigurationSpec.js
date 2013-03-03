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
			', { pretty: true, indent: '___:' })()).toBe([
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
			', {pretty:false})()).toBe([
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
			', {pretty:false})()).toBe([
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
			', {pretty:false,curly:true})()).toBe([
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
});