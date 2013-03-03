describe('Angular Parser: HTML Generation', function() {
	describe('Example case', function() {
		it('Parses correctly', function() {
			expect(siml.angular.parse('\
				section#main:cloak\n\
				  show( todos.length )\n\
					\n\
				  input#toggle-all:checkbox\n\
				    model( allChecked )\n\
				    click( markAll(allChecked) )\n\
				  label[for=toggle-all] \'Mark all as complete\'\n\
						\n\
				  ul#todo-list > li\n\
				    repeat( todo in todos | filter:statusFilter )\n\
				    class({\n\
				      completed: todo.completed,\n\
				      editing: todo == editedTodo\n\
				    })\n\
						\n\
				    div.view\n\
				      input.toggle:checkbox\n\
				        model( todo.completed )\n\
				        change( todoCompleted(todo) )\n\
				      label\n\
				        \'{{todo.title}}\'\n\
				        dblclick( editTodo(todo) )\n\
				      button.destroy\n\
				        click( removeTodo(todo) )\n\
						\n\
				    form\n\
				      submit( doneEditing(todo) )\n\
				      input.edit\n\
				        model( todo.title )\n\
				        $todoBlur( doneEditing(todo) )\n\
				        $todoFocus( todo == editedTodo )\n\
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
