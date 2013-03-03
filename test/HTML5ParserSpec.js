describe('HTML5 Parser: HTML Generation', function() {
	describe('Example case', function() {
		it('Parses correctly', function() {
			expect(siml.html5.parse('\
				doctype()\n\
				div\n\
					a\n\
					input:checkbox\n\
					input:datetime\n\
					input:radio\n\
					input:url\n\
			', {pretty:false})()).toBe([
				'<!doctype html>',
				'<div>',
					'<a></a>',
					'<input type="checkbox"/>',
					'<input type="datetime"/>',
					'<input type="radio"/>',
					'<input type="url"/>',
				'</div>'
			].join(''));
		});
	});
});
