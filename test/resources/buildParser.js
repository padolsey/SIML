function buildParser(src) {

	var xhr = new XMLHttpRequest();
	xhr.open('GET', src + '?' + +new Date, false);
	xhr.send(null);
	var parserCode = xhr.responseText;

	siml.PARSER = PEG.buildParser(parserCode, {
		cache: false,
		trackLineAndColumn: true
	});

}