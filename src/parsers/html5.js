(function() {

	var INPUT_TYPES = {
		button: 1, checkbox: 1, color: 1, date: 1, datetime: 1, 'datetime-local': 1,
		email: 1, file: 1, hidden: 1, image: 1, month: 1, number: 1, password: 1, radio: 1,
		range: 1, reset: 1, search: 1, submit: 1, tel: 1, text: 1, time: 1, url: 1, week: 1
	};

	siml.html5 = new siml.Parser({
		pretty: true,
		indent: '	',
		directives: {
			doctype: {
				type: 'CONTENT',
				make: function() {
					return '<!doctype html>'
				}
			}
		},
		psuedos: {
			_default: {
				type: 'ATTR',
				make: function(name) {
					if (this.parentElement.tag === 'input' && name in INPUT_TYPES) {
						return 'type="' + name + '"';
					}
					throw new Error('Unknown Pseduo: ' + name);
				}
			}
		}
	});

	siml.html5.INPUT_TYPES = INPUT_TYPES;

}());

