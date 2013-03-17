siml.angular = new siml.Generator({
	pretty: true,
	toTag: siml.html5.config.toTag,
	directives: {
		_default: {
			type: 'ATTR',
			make: function(name, value) {
				// camelCase -> snake-case
				name = name.replace(/([a-z])([A-Z])/g, function($0,$1,$2) {
					return $1 + '-' + $2.toLowerCase();
				});
				if (name.substring(0, 1) === '$') {
					name = name.substring(1);
				} else {
					name = 'ng-' + name;
				}
				return name + '="' + siml.Generator.escapeHTML(value) + '"';
			}
		}
	},
	pseudos: {
		_default: {
			type: 'ATTR',
			make: function(name) {
				if (this.parentElement.tag === 'input' && name in siml.html5.INPUT_TYPES) {
					return 'type="' + name + '"';
				}
				// camelCase -> snake-case
				return 'ng-' + name.replace(/([a-z])([A-Z])/g, function($0,$1,$2) {
					return $1 + '-' + $2.toLowerCase();
				});
			}
		}
	}
});
