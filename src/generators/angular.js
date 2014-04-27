siml.angular = new siml.Generator({
	pretty: true,
	toTag: siml.html5.config.toTag,
	directives: {
		doctype: siml.html5.config.directives.doctype,
		dt: siml.html5.config.directives.dt,
		_default: {
			type: 'ATTR',
			make: function(name, children, value) {
				// camelCase -> snake-case
				name = name.replace(/([a-z])([A-Z])/g, function($0,$1,$2) {
					return $1 + '-' + $2.toLowerCase();
				});
				if (name.substring(0, 1) === '$') {
					name = name.substring(1);
				} else {
					name = 'ng-' + name;
				}
				return name + '="' + value + '"';
			}
		}
	},
	pseudos: {
		_default: {
			type: 'ATTR',
			make: function(name) {
				var type = siml.html5.config.getPsuedoType(this.parentElement.tag.toLowerCase(), name);
				if (type) return type;
				// camelCase -> snake-case
				return 'ng-' + name.replace(/([a-z])([A-Z])/g, function($0,$1,$2) {
					return $1 + '-' + $2.toLowerCase();
				});
			}
		}
	}
});
