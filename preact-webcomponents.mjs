import { h, cloneElement, render, hydrate } from 'preact';

export default function register(Component, tagName, propNames, options) {
    function PreactElement() {
        const inst = Reflect.construct(HTMLElement, [], PreactElement);
        inst._vdomComponent = Component;
        inst._root =
            options && options.shadow ? inst.attachShadow({ mode: 'open' }) : inst;
        return inst;
    }
    PreactElement.prototype = Object.create(HTMLElement.prototype);
    PreactElement.prototype.constructor = PreactElement;
    PreactElement.prototype.connectedCallback = connectedCallback;
    PreactElement.prototype.attributeChangedCallback = attributeChangedCallback;
    PreactElement.prototype.disconnectedCallback = disconnectedCallback;

    propNames =
        propNames ||
        Component.observedAttributes ||
        Object.keys(Component.propTypes || {});
    PreactElement.observedAttributes = propNames;

    propNames.forEach((name) => {
        Object.defineProperty(PreactElement.prototype, name, {
            get() {
                return this._vdom.props[name];
            },
            set(v) {
                if (this._vdom) {
                    this.attributeChangedCallback(name, null, v);
                } else {
                    if (!this._props) this._props = {};
                    this._props[name] = v;
                    this.connectedCallback();
                }

                // Reflect property changes to attributes if the value is a primitive
                const type = typeof v;
                if (
                    v == null ||
                    type === 'string' ||
                    type === 'boolean' ||
                    type === 'number'
                ) {
                    this.setAttribute(name, v);
                }
            },
        });
    });

    return customElements.define(
        tagName || Component.tagName || Component.displayName || Component.name,
        PreactElement
    );
}

function ContextProvider(props) {
    this.getChildContext = () => props.context;
    const { context, children, ...rest } = props;
    return cloneElement(children, rest);
}

function connectedCallback() {
    const event = new CustomEvent('_preact', {
        detail: {},
        bubbles: true,
        cancelable: true,
    });
    this.dispatchEvent(event);
    const context = event.detail.context;

    this._vdom = h(
        ContextProvider,
        { ...this._props, context },
        toVdom(this, this._vdomComponent)
    );
    (this.hasAttribute('hydrate') ? hydrate : render)(this._vdom, this._root);
}

function toCamelCase(str) {
    return str.replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

function attributeChangedCallback(name, oldValue, newValue) {
    if (!this._vdom) return;
    newValue = newValue == null ? undefined : newValue;
    const props = {};
    props[name] = newValue;
    props[toCamelCase(name)] = newValue;
    this._vdom = cloneElement(this._vdom, props);
    render(this._vdom, this._root);
}

function disconnectedCallback() {
    render((this._vdom = null), this._root);
}

function Slot(props, context) {
    const ref = (r) => {
        if (!r) {
            this.ref.removeEventListener('_preact', this._listener);
        } else {
            this.ref = r;
            if (!this._listener) {
                this._listener = (event) => {
                    event.stopPropagation();
                    event.detail.context = context;
                };
                r.addEventListener('_preact', this._listener);
            }
        }
    };
    return h('slot', { ...props, ref });
}

function toVdom(element, nodeName) {
    if (element.nodeType === 3) return element.data;
    if (element.nodeType !== 1) return null;
    let children = [],
        props = {},
        i = 0,
        a = element.attributes,
        cn = element.childNodes;
    for (i = a.length; i--; ) {
        if (a[i].name !== 'slot') {
            props[a[i].name] = a[i].value;
            props[toCamelCase(a[i].name)] = a[i].value;
        }
    }

    for (i = cn.length; i--; ) {
        const vnode = toVdom(cn[i], null);
        const name = cn[i].slot;
        if (name) {
            props[name] = h(Slot, { name }, vnode);
        } else {
            children[i] = vnode;
        }
    }
    const wrappedChildren = nodeName ? h(Slot, null, children) : children;
    return h(nodeName || element.nodeName.toLowerCase(), props, wrappedChildren);
}
