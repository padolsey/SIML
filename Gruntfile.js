module.exports = function(grunt) {

	'use strict';

	var fs = require('fs');

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		jasmine: {
			siml: {
				options: {
					specs: ['test/*Spec.js'],
					helpers: ['test/resources/specHelpers.js'],
					template: 'test/resources/jasmine.tmpl'
				}
			}
		},
		concat: {
			'default': {
				src: [
					'src/intro.js',
					'src/siml.js',
					'.grunt/siml_parser.js',
					'src/outro.js'
				],
				dest: 'dist/siml.js'
			},
			all: {
				src: [
					'src/intro.js',
					'src/siml.js',
					'src/parsers/html5.js',
					'src/parsers/angular.js',
					'.grunt/siml_parser.js',
					'src/outro.js'
				],
				dest: 'dist/siml.all.js'
			},
			angular: {
				src: [
					'src/intro.js',
					'src/siml.js',
					'src/parsers/html5.js',
					'src/parsers/angular.js',
					'.grunt/siml_parser.js',
					'src/outro.js'
				],
				dest: 'dist/siml.angular.js'
			},
			html5: {
				src: [
					'src/intro.js',
					'src/siml.js',
					'src/parsers/html5.js',
					'.grunt/siml_parser.js',
					'src/outro.js'
				],
				dest: 'dist/siml.html5.js'
			}
		},
		uglify: {
			options: {
				banner: '/** Siml (c) 2013 James padolsey, http://github.com/padolsey/siml **/\n',
				compress: true,
				mangle: true
			},
			'default': {
				src: 'dist/siml.js',
				dest: 'dist/siml.min.js'
			},
			all: {
				src: 'dist/siml.all.js',
				dest: 'dist/siml.all.min.js'
			},
			angular: {
				src: 'dist/siml.angular.js',
				dest: 'dist/siml.angular.min.js'
			},
			html5: {
				src: 'dist/siml.html5.js',
				dest: 'dist/siml.html5.min.js'
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jasmine');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-concat');

	grunt.registerTask('default', ['build']);
	grunt.registerTask('test', ['jasmine']);

	grunt.registerTask('build', ['jasmine', 'buildParser', 'build:default', 'build:angular', 'build:html5', 'build:all']);

	// Currently two built types -- Default and Angular (with Angular directives/attrs etc.)
	grunt.registerTask('build:default', ['concat:default', 'uglify:default']);
	grunt.registerTask('build:angular', ['concat:angular', 'uglify:angular']);
	grunt.registerTask('build:html5', ['concat:html5', 'uglify:html5']);
	grunt.registerTask('build:all', ['concat:all', 'uglify:all']);

	grunt.registerTask('buildParser', function() {
		var parserJS = 'siml.PARSER = ' + require('./vendor/peg.js').buildParser(fs.readFileSync('src/parser.pegjs', 'utf8'), {
			cache: false,
			trackLineAndColumn: true
		}).toSource();
		fs.writeFileSync('./.grunt/siml_parser.js', parserJS);
	});
};
