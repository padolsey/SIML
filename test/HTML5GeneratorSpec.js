describe('HTML5 Parser: HTML Generation', function() {
	describe('Example case', function() {
		it('Parses correctly', function() {
			expect(siml.html5.parse('\
				@doctype()\n\
				div\n\
					a\n\
					input:checkbox\n\
					input:datetime\n\
					input:radio\n\
					input:url\n\
					button:submit\n\
					button:reset\n\
					button:button\n\
			', {pretty:false})).toBe([
				'<!doctype html>',
				'<div>',
					'<a></a>',
					'<input type="checkbox"/>',
					'<input type="datetime"/>',
					'<input type="radio"/>',
					'<input type="url"/>',
					'<button type="submit"></button>',
					'<button type="reset"></button>',
					'<button type="button"></button>',
				'</div>'
			].join(''));
		});
	});
	describe('Quick tags + Single line parsing', function() {
		it('Parses a simple doc from a single line', function() {
			expect(siml.html5.parse('html (hd{meta[charset=utf-8]+title{"cool"}}bdy "Look ma, no hands!")',{pretty:false})).toBe([
				'<html>',
					'<head>',
						'<meta charset="utf-8"/>',
						'<title>cool</title>',
					'</head>',
					'<body>',
						'Look ma, no hands!',
					'</body>',
				'</html>'
			].join(''));
		});
	});
});
