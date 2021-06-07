/*!
 * CDOM v0.1.0 (https://github.com/AmbroseCavalier/cdom)
 *
 * Copyright 2021 Ambrose Cavalier
 * Licensed under the MIT (https://github.com/AmbroseCavalier/cdom/blob/master/LICENSE)
 */

type Primitive = string | number | boolean | undefined | null;
type PrimitiveOrEventListener = Primitive | ((evt: Event) => void);
type AttrMap = Record<string, PrimitiveOrEventListener>;

const nonAttributeProperties = ["value", "checked"];

// from https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js#L202
const booleanAttributes = [
	"allowfullscreen",
	"async",
	"autofocus",
	"autoplay",
	"checked",
	"compact",
	"controls",
	"declare",
	"default",
	"defaultchecked",
	"defaultmuted",
	"defaultselected",
	"defer",
	"disabled",
	"enabled",
	"formnovalidate",
	"hidden",
	"indeterminate",
	"inert",
	"ismap",
	"itemscope",
	"loop",
	"multiple",
	"muted",
	"nohref",
	"noresize",
	"noshade",
	"novalidate",
	"nowrap",
	"open",
	"pauseonexit",
	"readonly",
	"required",
	"reversed",
	"scoped",
	"seamless",
	"selected",
	"sortable",
	"truespeed",
	"typemustmatch",
	"visible"
];

function setAttrOrProp(el: SVGElement | HTMLElement, name: string, val: Primitive) {
	if (name === "style") {
		el.style.cssText = (val ?? "").toString();
	} else if (booleanAttributes.includes(name.toLowerCase())) {
		if (val) {
			el.setAttribute(name, "true");
		} else {
			el.removeAttribute(name);
		}
	} else if (nonAttributeProperties.includes(name)) {
		// @ts-ignore
		el[name] = val;
	} else {
		// @ts-ignore
		el.setAttribute(name, val);
	}
}

function createElementFromParams(
	tagName: string,
	namespace: ElementNamespace,
	attrs: AttrMap | null
) {
	//See https://stackoverflow.com/a/28734954
	let el: SVGElement | HTMLElement;
	if (namespace === "svg") {
		el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
	} else {
		el = document.createElement(tagName);
	}

	if (attrs) {
		for (const attributeName in attrs) {
			const val = attrs[attributeName];
			if (attributeName.startsWith("on")) {
				if (typeof val !== "function") {
					throw new Error(`Got non-function for "${attributeName}".`);
				}
				//@ts-ignore
				el.addEventListener(attributeName.substring(2).toLowerCase(), val);
			} else if (typeof val === "function") {
				throw new Error(`Got function for "${attributeName}".`);
			} else {
				setAttrOrProp(el, attributeName, val ?? "");
			}
		}
	}

	return el;
}

let currentNode: Node | null;
function addNode<T extends Node>(node: T): T {
	if (currentNode) {
		currentNode.appendChild(node);
	}
	return node;
}

function stringifyForInner(val: Primitive): string {
	return val?.toString() ?? "";
}

type ElementNamespace = "xhtml" | "svg";

type InnerDescriptor = (() => void) | Primitive;
function handleNodeInner(node: Node, inner: InnerDescriptor | null): Node {
	if (inner !== null) {
		if (typeof inner === "function") {
			const oldCurrent = currentNode;
			currentNode = node;
			try {
				inner();
			} finally {
				currentNode = oldCurrent;
			}
		} else {
			node.appendChild(document.createTextNode(stringifyForInner(inner)));
		}
	}
	return node;
}

function createAndAddElement(
	namespace: ElementNamespace,
	tagName: string,
	attrs: AttrMap | null,
	inner: InnerDescriptor | null
): Node {
	return handleNodeInner(addNode(createElementFromParams(tagName, namespace, attrs)), inner);
}
type BoundCreateFunc<N> = ((attrs: AttrMap) => N) &
	((attrs: AttrMap, inner: InnerDescriptor) => N) &
	((inner: InnerDescriptor) => N) &
	(() => N);

function makeElementProxy<N>(namespace: ElementNamespace) {
	return new Proxy(Object.create(null), {
		get(target, tagName, receiver): BoundCreateFunc<N> {
			if (typeof tagName !== "string") {
				throw new Error("tagName must be a string");
			}
			tagName = tagName.toLowerCase();
			function boundCreate(a?: any, b?: any): N {
				if (typeof a === "undefined" && typeof b === "undefined") {
					return createAndAddElement(namespace, tagName as string, null, null) as unknown as N;
				} else if (typeof a === "object" && typeof b === "undefined") {
					return createAndAddElement(namespace, tagName as string, a, null) as unknown as N;
				} else if (typeof b === "undefined") {
					return createAndAddElement(namespace, tagName as string, null, a) as unknown as N;
				} else if (typeof a === "object") {
					return createAndAddElement(namespace, tagName as string, a, b) as unknown as N;
				} else {
					throw new Error("Unexpected state");
				}
			}
			return boundCreate;
		}
	});
}

const CDOM = {
	elements: makeElementProxy("xhtml") as {
		[K in keyof HTMLElementTagNameMap]: BoundCreateFunc<HTMLElementTagNameMap[K]>;
	},
	svgElements: makeElementProxy("svg") as {
		[K in keyof SVGElementTagNameMap]: BoundCreateFunc<SVGElementTagNameMap[K]>;
	},
	node<T extends Node>(node: T): T {
		return addNode(node);
	},
	html(html: string): void {
		const tmp = document.createElement("template");
		tmp.innerHTML = html;
		const frag = tmp.content;
		addNode(frag);
	},
	text(val: Primitive): Node {
		return addNode(document.createTextNode(stringifyForInner(val)));
	},
	replaceInner(node: Node, inner: () => void): void {
		node.textContent = "";
		handleNodeInner(node, inner);
	}
};

export default CDOM;
