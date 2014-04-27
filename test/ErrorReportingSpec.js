describe('Error Reporting', function() {
	describe('When a syntax error occurs during parsing', function() {
		it('Should throw the correct line and character number', function() {

// TODO: IMPROVE ERROR REPORTING
		/*

			expect(function() {
				siml.parse('^');
			}).toThrow('SIML: Line 1, column 1: Expected AttributeName, Directive, Element or String but "^" found.');

			expect(function() {
				siml.parse('\
abc {\n\
	;\n\
}\n\
				');
			}).toThrow('SIML: Line 1, column 5: Expected ":", ";", AttributeName, Directive, Element or String but "{" found.');


	expect(function() {
				siml.parse('\
abc {\n\
	// Just a comment\n\
	"a\n\
		multiline\n\
			string...\n\
	"\n\
	a { href: "foo" }\n\
	/**\n\
	 * Another comment \n\
	 /\n\
	 a b c\n\
	 #\n\
	 div.foo#b "thing"\n\
}\n\
				');
			}).toThrow('s');*/

		});
	});
});