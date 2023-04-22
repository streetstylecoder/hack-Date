"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emmet = require("emmet");
const prettier = require("prettier");
const pickFirstValue = (values) => {
    const value = (values || [])[0];
    return typeof value === 'string' ? value : '';
};
const asNode = (abbrNode) => {
    var _a;
    return {
        name() {
            return abbrNode.name || '';
        },
        content: pickFirstValue(abbrNode.value),
        attributeList() {
            return (abbrNode.attributes || []).map((attr) => {
                return {
                    name: attr.name || '',
                    value: pickFirstValue(attr.value),
                };
            });
        },
        children: (_a = abbrNode.children) === null || _a === void 0 ? void 0 : _a.map(asNode),
    };
};
const toOtherAttrString = (attrs) => {
    const otherAttrs = attrs.filter((attr) => !/^(class|id)$/.test(attr.name));
    return otherAttrs.length
        ? JSON.stringify(otherAttrs.reduce((o, { name, value }) => {
            o[name] = value;
            return o;
        }, {}))
        : '';
};
const toClassString = (attrs) => {
    const classAttr = attrs.find((attr) => attr.name === 'class');
    return classAttr == null
        ? ''
        : classAttr.value
            .split(' ')
            .map((s) => `.${s}`)
            .join('');
};
const toIdString = (attrs) => {
    const idAttr = attrs.find((attr) => attr.name === 'id');
    return idAttr == null ? '' : `#${idAttr.value}`;
};
const toChildrenString = (children, content, options) => {
    return children.length === 0
        ? content === ''
            ? ''
            : JSON.stringify(content)
        : '[' + children.map((c) => expandNode(c, options)).join(',') + ']';
};
const expandNode = (node, options) => {
    const name = !options.outputDefaultTagName && node.name() === 'div' ? '' : node.name();
    const content = node.content;
    const attrs = node.attributeList() || [];
    const classStr = toClassString(attrs);
    const id = toIdString(attrs);
    const otherAttr = toOtherAttrString(attrs);
    const children = toChildrenString(node.children || [], content, options);
    const isComponent = /^[A-Z]/.test(name);
    const selectorStr = isComponent
        ? name
        : "'" + [name, id, classStr].filter((s) => s !== '').join('') + "'";
    const bodyStr = [selectorStr, otherAttr, children]
        .filter((s) => s !== '')
        .join(',');
    return `${options.vnodeFactoryFunctionName}(${bodyStr})`;
};
function expand(abbr, { vnodeFactoryFunctionName = 'm', outputDefaultTagName = false, } = {}) {
    const root = emmet.parseMarkup(abbr, emmet.resolveConfig({ syntax: 'html' }));
    const expanded = (root.children || [])
        .map((abbrNode) => expandNode(asNode(abbrNode), {
        vnodeFactoryFunctionName,
        outputDefaultTagName,
    }))
        .join(',');
    let formatted;
    try {
        formatted = prettier.format(expanded, {
            semi: false,
            singleQuote: true,
            parser: 'babel',
        });
    }
    catch (error) {
        // console.error('[mithril-emmet]', error)
        formatted = expanded;
    }
    return formatted;
}
exports.expand = expand;
//# sourceMappingURL=expander.js.map