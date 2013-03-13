describe('Angular Parser: HTML Generation', function() {
	describe('Example case', function() {
		it('Parses correctly', function() {
			expect(siml.angular.parse('\
				section#main:cloak {\
				  @show( todos.length )\
					\
				  input#toggle-all:checkbox {\
				    @model( allChecked )\
				    @click( markAll(allChecked) )\
				  }\
				  label[for=toggle-all] {\'Mark all as complete\'\}\
				\
				  ul#todo-list > li {\
				    @repeat( todo in todos | filter:statusFilter )\
				    @class({\
				      completed: todo.completed,\
				      editing: todo == editedTodo\
				    })\
				\
				    div.view {\
				      input.toggle:checkbox {\
				        @model( todo.completed )\
				        @change( todoCompleted(todo) )\
				      }\
				      label {\
				        \'{{todo.title}}\'\
				        @dblclick( editTodo(todo) )\
				      }\
				      button.destroy {\
				      	@click( removeTodo(todo) )\
				      }\
				    }\
				\
				    form {\
				      @submit( doneEditing(todo) )\
				      input.edit {\
				        @model( todo.title )\
				        @$todoBlur( doneEditing(todo) )\
				        @$todoFocus( todo == editedTodo )\
				      }\
				    }\
				\
				  }\
				\
				}\
			', {pretty:false})).toBe([
				'<section id="main" ng-cloak ng-show="todos.length">',
					'<input id="toggle-all" type="checkbox" ng-model="allChecked" ng-click="markAll(allChecked)"/>',
					'<label for="toggle-all">Mark all as complete</label>',
					'<ul id="todo-list">',
						'<li ng-repeat="todo in todos | filter:statusFilter" ng-class="{ completed: todo.completed, editing: todo == editedTodo }">',
							'<div class="view">',
								'<input class="toggle" type="checkbox" ng-model="todo.completed" ng-change="todoCompleted(todo)"/>',
								'<label ng-dblclick="editTodo(todo)">{{todo.title}}</label>',
								'<button class="destroy" ng-click="removeTodo(todo)"></button>',
							'</div>',
							'<form ng-submit="doneEditing(todo)">',
								'<input class="edit" ng-model="todo.title" todo-blur="doneEditing(todo)" todo-focus="todo == editedTodo"/>',
							'</form>',
						'</li>',
					'</ul>',
				'</section>'
			].join(''));
		});
	});
});
