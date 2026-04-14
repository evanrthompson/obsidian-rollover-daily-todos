import { getTodoStatus, getIndent } from "./todo-utils";

class TodoParser {
  #lines;
  #withChildren;
  #doneStatusMarkers;

  constructor(lines, withChildren, doneStatusMarkers) {
    this.#lines = lines;
    this.#withChildren = withChildren;
    this.#doneStatusMarkers = doneStatusMarkers || "xX-";
  }

  #isTodo(s) {
    return getTodoStatus(s, this.#doneStatusMarkers) === "open";
  }

  #hasChildren(l) {
    if (l + 1 >= this.#lines.length) return false;
    return getIndent(this.#lines[l + 1]) > getIndent(this.#lines[l]);
  }

  #getChildren(parentLinum) {
    const children = [];
    let nextLinum = parentLinum + 1;
    while (this.#isChildOf(parentLinum, nextLinum)) {
      children.push(this.#lines[nextLinum]);
      nextLinum++;
    }
    return children;
  }

  #isChildOf(parentLinum, linum) {
    if (parentLinum >= this.#lines.length || linum >= this.#lines.length) {
      return false;
    }
    return getIndent(this.#lines[linum]) > getIndent(this.#lines[parentLinum]);
  }

  getTodos() {
    let todos = [];
    for (let l = 0; l < this.#lines.length; l++) {
      const line = this.#lines[l];
      if (this.#isTodo(line)) {
        todos.push(line);
        if (this.#withChildren && this.#hasChildren(l)) {
          const cs = this.#getChildren(l);
          todos = [...todos, ...cs];
          l += cs.length;
        }
      }
    }
    return todos;
  }
}

export const getTodos = ({
  lines,
  withChildren = false,
  doneStatusMarkers = null,
}) => {
  const todoParser = new TodoParser(lines, withChildren, doneStatusMarkers);
  return todoParser.getTodos();
};
