# SIML

SIML is the Simplified Markup Language. **[Try it out!](http://padolsey.github.com/siml/)**

### What is it?

SIML allows you to write HTML/XML with more ease and less cruft.

You can specify your elements by CSS selectors:

```html
div           -> <div></div>
p.foo         -> <p class="foo"></p>
div#x.ace     -> <div id="x" class="ace"></div>
em > span     -> <em><span></span></em>
em 'Ok then'  -> <em>Ok then</em>
```

SIML allows nesting with curlies, just like [Sassy CSS](http://sass-lang.com/):

```css
section.body {
  h1#title {
    'Title'
  }
}
```

Or significant whitespace (i.e. *indent to nest*):

```text
section.body
  h1#title
    'Title'
```

Hell, we can do better than that:

```text
section.body > h1#title 'Title'
```

That'll give us:

```html
<section class="body">
  <h1 id="title">
    Title
  </h1>
</section>
```

SIML gives you the expressive power of CSS selectors. It also supports Attributes, Text and Directives. 

```css
section {          // Selector
  class: body      // Attribute
  ' foo blah '     // Internal `_fillText` Directive
  text: 'foo'      // Custom Text Attribute
}
```

*Note: You can extend SIML to support your own attributes, directives and psuedo-classes. E.g. See [parsers/angular.js](https://github.com/padolsey/siml/blob/master/src/parsers/angular.js)*

SIML allows you to express more with less effort and a cleaner form:

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

### SIML's Extensibility

SIML allows you to make your own SIML parser by configuring:

 * Attribute handlers
 * Directive handlers
 * Pseudo-class handlers

This means, with a bit of configuration, you can write custom markup for your bespoke need. E.g.

*This uses the [angular parser](https://github.com/padolsey/siml/blob/master/src/parsers/angular.js) which converts directives and undefined pseudo-classes to `ng-` attributes.*

```js
ul#todo-list > li
  repeat( todo in todos | filter:statusFilter )
  class({
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

### Distributions

 * `dist/siml.js`: This is the default parser. No fancy stuff. Not even `input:checkbox` support.
 * `dist/siml.html5.js`: For now, this includes small things like `doctype()` support and `input:type` suppport.
 * `dist/siml.angular.js`: This is the angular parser, which makes it easier to write `ng-...` attributes with directives/pseudo-classes. ([Example here](https://github.com/padolsey/siml/blob/master/test/resources/angular-test.siml)). *Currently also includes `input:type` support*.
 * `dist/siml.all.js`: This includes html5 and angular.

### How to use:

Calling `parse()` returns a function which you should call to generate the HTML. Internally the actual SIML is only parsed once.

#### Browser:

```html
<script src="dist/siml.all.min.js"></script>
<script>
  siml.html5.parse('a.foo#blah{span "ok"}', {
  	curly: false,  // [default=false] pass true if you're using curlies for hierarchy
  	pretty: false, // [default=true] Will give you pretty HTML
  	indent: '....' // [default='  '] Use custom indentation when pretty=true
  })();
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
siml.html5.parse('input:checkbox')(); // => '<input type="checkbox" />'
```

More to come...
