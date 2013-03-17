# SIML

**SIML is the Simplified Markup Language.
It is a conceptual hybrid strongly inspired by the simplicity of CSS selectors and SASS-style nesting.**

 * **[Try it out here!](http://padolsey.github.com/SIML/)**
 * [See 101 intro wiki](https://github.com/padolsey/SIML/wiki/101---Introduction)
 * [AngularJS user? -- Look at this!](https://github.com/padolsey/SIML/wiki/AngularJS)

### Why did you make it?

 * This project was originally a personal exploration into the world of language parsing
 * Writing HTML isn't the worst thing in the world. But it takes time. And as a programmer, I'm lazy.
 * I enjoy the expressive power of tiny expressions (hence my love of Perl and RegExps)

### *Another* templating hybrid whatchamacallit!1!?

No, SIML isn't a templating language. It doesn't currently provide constructs for
including data, controlling flow or looping. Reasoning behind this:

1. Feature bloat
2. People still write plain ol' HTML
3. Pure DOM templates are on the rise. See AngularJS or Knockout.

### What is it?

SIML allows you to write HTML with more ease and less cruft. *"SIML"* is the name of the language, 
and also the utility for converting the language to HTML.

You can specify your elements through CSS selectors:

```html
div           -> <div></div>
p.foo[baz]    -> <p class="foo" baz></p>
div#x.ace     -> <div id="x" class="ace"></div>
em > span     -> <em><span></span></em>
em 'Ok then'  -> <em>Ok then</em>
```

Ok, the last one wasn't a CSS selector, it included a string. But it makes sense, right?

SIML allows nesting with curlies, just like [Sassy CSS](http://sass-lang.com/):

```css
section.body {
  h1#title {
    'Title'
  }
}
```

Or significant whitespace (i.e. *indent to nest*):

```css
section.body
  h1#title
    'Title'
```

But you're not forced to build hierarchies with nesting; you can do one-liners instead:

```text
section.body > h1#title 'Title'
```

That'll give you:

```html
<section class="body">
  <h1 id="title">
    Title
  </h1>
</section>
```

As shown, SIML gives you the expressive power of CSS selectors. It also supports Attributes, Text and Directives. 

```js
section {          // Selector
  class: body      // Attribute
  ' foo blah '     // Text directive
  text: 'foo'      // Custom Text Attribute
  @foo(1,2,3)      // Custom directive
}
```

*Note: You can extend SIML to support your own attributes, directives and psuedo-classes. For an example see [parsers/angular.js](https://github.com/padolsey/siml/blob/master/src/parsers/angular.js)*

SIML allows you to express more with less effort and, perhaps, more clarity:

```js
section.contact > form

  h2 'Enter contact details'

  label[for=name]
    'Your name?'
    input#name
  
  label[for=human]
    'Are you human?'
    input:checkbox#human

  input:submit 'Submit form...'
```

That would give you:

```html
<section class="contact">
  <form>
    <h2>
      Enter contact details
    </h2>
    <label for="name">
      Your name?
      <input id="name"/>
    </label>
    <label for="human">
      Are you human?
      <input type="checkbox" id="human"/>
    </label>
    <input type="submit"/>
  </form>
</section>
```

### Is that it!?

Nope. SIML has some hidden gems. Some are still being tweaked. 

For example, you can use the syntax `(.../.../...)` to form an ExclusiveGroup which will make SIML expand a hierarchy to conform to the alternates you specify:

```text
a (b/c) // <a><b></b></a><a><c></c></a>
```

The above would be the same as writing:

```text
a b
a c
```

A more useful example:

```text
ul li ('wow'/'this'/'is'/'cool')
```

Becomes:

```html
<ul>
  <li>wow</li>
  <li>this</li>
  <li>is</li>
  <li>cool</li>
</ul>
```

Another cool feature is multipliers (looks like a numeric psuedo class):

```text
div a:3
```

Becomes:

```html
<div>
  <a></a>
  <a></a>
  <a></a>
</div>
```

### SIML's Extensibility

SIML allows you to make your own SIML parser by configuring:

 * Attribute handlers
 * Directive handlers
 * Pseudo-class handlers

This means, with a bit of configuration, you can write custom markup for your bespoke need. E.g.

*This uses the [angular parser](https://github.com/padolsey/siml/blob/master/src/parsers/angular.js) which converts directives and undefined pseudo-classes to `ng-` attributes.*

```text
ul#todo-list > li
  @repeat( todo in todos | filter:statusFilter )
  @class({
    completed: todo.completed,
    editing: todo == editedTodo
  })
```

This would become:

```html
<ul id="todo-list">
  <li
    ng-repeat="todo in todos | filter:statusFilter"
    ng-class="{ completed: todo.completed, editing: todo == editedTodo }"
  ></li>
</ul>
```

**[More info on AngularJS in SIML](https://github.com/padolsey/SIML/wiki/AngularJS)**

### Distributions

 * `dist/siml.js`: This is the default parser. No fancy stuff. Not even `input:checkbox` support.
 * `dist/siml.html5.js`: For now, this includes small things like `doctype()` support and `input:type` suppport.
 * `dist/siml.angular.js`: This is the angular parser, which makes it easier to write `ng-...` attributes with directives/pseudo-classes. ([Example here](https://github.com/padolsey/siml/blob/master/test/resources/angular-test.siml)). *Currently also includes `input:type` support*.
 * `dist/siml.all.js`: This includes html5 and angular.

### How to use:

#### Browser:

```html
<script src="dist/siml.all.min.js"></script>
<script>
  siml.html5.parse('a.foo#blah{span "ok"}', {
  	curly: false,  // [default=false] pass true if you're using curlies for hierarchy
  	pretty: false, // [default=true] Will give you pretty HTML
  	indent: '....' // [default='  '] Use custom indentation when pretty=true
  });
  // Generates:
  //   <a id="blah" class="foo">
  //   ....<span>
  //   ........ok
  //   ....</span>
  //   </a>
</script>
```

#### Node:

```
npm install siml
```

```js
var siml = require('siml');

// Using the html5 parser (e.g. to support :checkbox)
siml.html5.parse('input:checkbox'; // => '<input type="checkbox" />'
```

More to come...

## CHANGELOG

 * 0.2.0 Introduced single line macro-type selectors and quick-tags (vowelless) as part of the HTML5 parser, e.g. `html hd{meta[charset=utf-8]+title{'Cool'}} bdy`
 * 0.2.1 Various features added
 * 0.3.0
  * Many optimisations to prevent pointless backtracking in the parser
  * Refactor of parser components.
  * Introduction of ExclusiveGroups (`(a/b)`) and InclusiveGroups (`a+b,d`)
  * Improvement of specs
