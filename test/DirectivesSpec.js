describe('Directives', function() {

	describe('Custom Generator with directives', function() {

		var directives = {};

		var customGen = new siml.Generator({
			directives: directives,
			pretty: false
		});

		it('Throws error on undefined directives', function() {
			expect(function() {
				customGen.parse('a @foo');
			}).toThrow('SIML: Directive not resolvable: foo');
		});

		describe('Custom @foo directive', function() {

			beforeEach(function() {
				directives.foo = {
					type: 'CONTENT',
					make: function(name, children/*, args */) {
						this.parentElement.htmlContent.push(
							'<foo>' + [].slice.call(arguments, 2).join()
						);
						if (children.length) {
							this.parentElement.processChildren(children);
						}
						this.parentElement.htmlContent.push('</foo>');
					}
				};
			});

			afterEach(function() {
				delete directives.foo;
			});

			it('Generates @foo with no args correctly', function() {
				expect(customGen.parse('div @foo')).toBe('<div><foo></foo></div>');
			});

			it('Generates @foo with args correctly', function() {
				expect(customGen.parse('div @foo(123,"four",  false)')).toBe('<div><foo>123,four,false</foo></div>');
			});

			it('Generates @foo with args & children correctly', function() {
				expect(customGen.parse('div @foo(1,2,3) { a, b }')).toBe('<div><foo>1,2,3<a></a><b></b></foo></div>');
				expect(customGen.parse('\
					div\n\
						h1\n\
							@foo WOW\n\
				')).toBe('<div><h1><foo><WOW></WOW></foo></h1></div>');
				expect(customGen.parse('\
					div\n\
						@foo\n\
							@foo\n\
								@foo(4) @foo\n\
				')).toBe('<div><foo><foo><foo>4<foo></foo></foo></foo></foo></div>');
			});

		});

	});

});