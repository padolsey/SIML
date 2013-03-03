# Siml

Siml is the Simplified Markup Language. 

### What is it?

On the surface, Siml is a utility that turns CSS selectors into HTML:

```html
div           -> <div></div>
p.foo         -> <p class="foo"></p>
div#x.ace     -> <div id="x" class="ace"></div>
em > span     -> <em><span></span></em>
em 'Ok then'  -> <em>Ok then</em>
```

Siml also supports nesting with curlies:

```css
section.body {
  h1 {
    'Title'
  }
}
```

Or significant whitespace:

```text
section.body
  h1
    'Title'
```

Hell, we can do better than that:

```text
section.body > h1 'Title'
```

That'll give us:

```html
<section class="body">
  <h1>
    Title
  </h1>
</section>
```

Siml gives you the expressive power of CSS selectors. You're mostly writing CSS, except instead of declaring styles you're declaring markup.

The basic components of Siml are Selectors, Attributes, Text and Directives. 

```css
section {          // Selector
  class: body      // Attribute
  ' foo blah '     // Internal `_fillText` Directive
  text: 'foo'      // Custom Text Attribute
}
```

You're free to build a hierarchy with indentation or curlies:

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

That gives you:

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

### Siml's Extensibility

Siml allows you to make your own Siml parser by configuring:

 * Attribute handlers
 * Directive handlers
 * Pseudo-class handlers

This means, with a bit of configuration, you can write custom markup for your bespoke need. E.g.

*(Using dist/siml.angular.js, example from https://github.com/addyosmani/todomvc)*

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

### How to use:

Browser:

```html
<script src="dist/siml.min.js"></script>
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

Node:

```js
var siml = require('./siml.html5.js'); // npm module will come later...
siml.html5.parse('...'); //...
```

More to come...
