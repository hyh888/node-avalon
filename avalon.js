/*==================================================
 Copyright (c) 2013-2015 司徒正美 and other contributors
 http://www.cnblogs.com/rubylouvre/
 https://github.com/RubyLouvre
 http://weibo.com/jslouvre/
 
 Released under the MIT license
 avalon.js 1.43 built in 2015.5.8
 用于后端渲染
 */
(function(){

var parse5 = require('parse5')
var parser = new parse5.Parser()
var expose = Date.now()

    function log() {
        if (avalon.config.debug) {
            // http://stackoverflow.com/questions/8785624/how-to-safely-wrap-console-log
            console.log.apply(console, arguments)
        }
    }
    /**
     * Creates a new object without a prototype. This object is useful for lookup without having to
     * guard against prototypically inherited properties via hasOwnProperty.
     *
     * Related micro-benchmarks:
     * - http://jsperf.com/object-create2
     * - http://jsperf.com/proto-map-lookup/2
     * - http://jsperf.com/for-in-vs-object-keys2
     */
var window = {}

    function createMap() {
        return Object.create(null)
    }

var subscribers = "$" + expose
var otherRequire = window.require
var otherDefine = window.define
var innerRequire
var stopRepeatAssign = false
var rword = /[^, ]+/g //切割字符串为一个个小块，以空格或豆号分开它们，结合replace实现字符串的forEach
var rcomplexType = /^(?:object|array)$/
var rsvg = /^\[object SVG\w*Element\]$/
var rwindow = /^\[object (?:Window|DOMWindow|global)\]$/
var oproto = Object.prototype
var ohasOwn = oproto.hasOwnProperty
var serialize = oproto.toString
var ap = Array.prototype
var aslice = ap.slice
var Registry = {} //将函数曝光到此对象上，方便访问器收集依赖
var W3C = true

var class2type = {}
"Boolean Number String Function Array Date RegExp Object Error".replace(rword, function(name) {
    class2type["[object " + name + "]"] = name.toLowerCase()
})

    function noop() {}

    function oneObject(array, val) {
        if (typeof array === "string") {
            array = array.match(rword) || []
        }
        var result = {},
            value = val !== void 0 ? val : 1
        for (var i = 0, n = array.length; i < n; i++) {
            result[array[i]] = value
        }
        return result
    }

    //生成UUID http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
var generateID = function(prefix) {
    prefix = prefix || "avalon"
    return (prefix + Math.random() + Math.random()).replace(/0\./g, "")
}

var avalon = function(el) { //创建jQuery式的无new 实例化结构
    return new avalon.init(el)
}
module.exports = avalon

/*视浏览器情况采用最快的异步回调*/
avalon.nextTick = function(fn) {
    process.nextTick(fn)
} // jsh

// https://github.com/rsms/js-lru
var Cache = new function() {// jshint ignore:line
    function LRU(maxLength) {
        this.size = 0
        this.limit = maxLength
        this.head = this.tail = void 0
        this._keymap = {}
    }

    var p = LRU.prototype

    p.put = function(key, value) {
        var entry = {
            key: key,
            value: value
        }
        this._keymap[key] = entry
        if (this.tail) {
            this.tail.newer = entry
            entry.older = this.tail
        } else {
            this.head = entry
        }
        this.tail = entry
        if (this.size === this.limit) {
            this.shift()
        } else {
            this.size++
        }
        return value
    }

    p.shift = function() {
        var entry = this.head
        if (entry) {
            this.head = this.head.newer
            this.head.older =
                    entry.newer =
                    entry.older =
                    this._keymap[entry.key] = void 0
        }
    }
    p.get = function(key) {
        var entry = this._keymap[key]
        if (entry === void 0)
            return
        if (entry === this.tail) {
            return  entry.value
        }
        // HEAD--------------TAIL
        //   <.older   .newer>
        //  <--- add direction --
        //   A  B  C  <D>  E
        if (entry.newer) {
            if (entry === this.head) {
                this.head = entry.newer
            }
            entry.newer.older = entry.older // C <-- E.
        }
        if (entry.older) {
            entry.older.newer = entry.newer // C. --> E
        }
        entry.newer = void 0 // D --x
        entry.older = this.tail // D. --> E
        if (this.tail) {
            this.tail.newer = entry // E. <-- D
        }
        this.tail = entry
        return entry.value
    }
    return LRU
}// jshint ignore:line

/*********************************************************************
 *                           配置系统                                 *
 **********************************************************************/

function kernel(settings) {
    for (var p in settings) {
        if (!ohasOwn.call(settings, p))
            continue
        var val = settings[p]
        if (typeof kernel.plugins[p] === "function") {
            kernel.plugins[p](val)
        } else if (typeof kernel[p] === "object") {
            avalon.mix(kernel[p], val)
        } else {
            kernel[p] = val
        }
    }
    return this
}
var openTag, closeTag, rexpr, rexprg, rbind, rregexp = /[-.*+?^${}()|[\]\/\\]/g

function escapeRegExp(target) {
    //http://stevenlevithan.com/regex/xregexp/
    //将字符串安全格式化为正则表达式的源码
    return (target + "").replace(rregexp, "\\$&")
}

var plugins = {
    loader: function (builtin) {
        var flag = innerRequire && builtin
        window.require = flag ? innerRequire : otherRequire
        window.define = flag ? innerRequire.define : otherDefine
    },
    interpolate: function (array) {
        openTag = array[0]
        closeTag = array[1]
        if (openTag === closeTag) {
            throw new SyntaxError("openTag!==closeTag")
        } else if (array + "" === "<!--,-->") {
            kernel.commentInterpolate = true
        } else {
            var test = openTag + "test" + closeTag
            if (test.indexOf("<") > -1) {
                throw new SyntaxError("此定界符不合法")
            }
        }
        var o = escapeRegExp(openTag),
                c = escapeRegExp(closeTag)
        rexpr = new RegExp(o + "(.*?)" + c)
        rexprg = new RegExp(o + "(.*?)" + c, "g")
        rbind = new RegExp(o + ".*?" + c + "|\\sms-")
    }
}

kernel.debug = true
kernel.plugins = plugins
kernel.plugins['interpolate'](["{{", "}}"])
kernel.paths = {}
kernel.shim = {}
kernel.maxRepeatSize = 100
avalon.config = kernel
/*********************************************************************
 *                 avalon的静态方法定义区                              *
 **********************************************************************/
avalon.init = function (el) {
    this[0] = this.element = el
}
avalon.fn = avalon.prototype = avalon.init.prototype

avalon.type = function (obj) { //取得目标的类型
    if (obj == null) {
        return String(obj)
    }
    // 早期的webkit内核浏览器实现了已废弃的ecma262v4标准，可以将正则字面量当作函数使用，因此typeof在判定正则时会返回function
    return typeof obj === "object" || typeof obj === "function" ?
            class2type[serialize.call(obj)] || "object" :
            typeof obj
}

var isFunction = function (fn) {
    return serialize.call(fn) === "[object Function]"
}

avalon.isFunction = isFunction

avalon.isWindow = function (obj) {
    return rwindow.test(serialize.call(obj))
}

/*判定是否是一个朴素的javascript对象（Object），不是DOM对象，不是BOM对象，不是自定义类的实例*/

avalon.isPlainObject = function (obj) {
    // 简单的 typeof obj === "object"检测，会致使用isPlainObject(window)在opera下通不过
    return serialize.call(obj) === "[object Object]" && Object.getPrototypeOf(obj) === oproto
}

//与jQuery.extend方法，可用于浅拷贝，深拷贝
avalon.mix = avalon.fn.mix = function () {
    var options, name, src, copy, copyIsArray, clone,
            target = arguments[0] || {},
            i = 1,
            length = arguments.length,
            deep = false

    // 如果第一个参数为布尔,判定是否深拷贝
    if (typeof target === "boolean") {
        deep = target
        target = arguments[1] || {}
        i++
    }

    //确保接受方为一个复杂的数据类型
    if (typeof target !== "object" && !isFunction(target)) {
        target = {}
    }

    //如果只有一个参数，那么新成员添加于mix所在的对象上
    if (i === length) {
        target = this
        i--
    }

    for (; i < length; i++) {
        //只处理非空参数
        if ((options = arguments[i]) != null) {
            for (name in options) {
                src = target[name]
                copy = options[name]
                // 防止环引用
                if (target === copy) {
                    continue
                }
                if (deep && copy && (avalon.isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {

                    if (copyIsArray) {
                        copyIsArray = false
                        clone = src && Array.isArray(src) ? src : []

                    } else {
                        clone = src && avalon.isPlainObject(src) ? src : {}
                    }

                    target[name] = avalon.mix(deep, clone, copy)
                } else if (copy !== void 0) {
                    target[name] = copy
                }
            }
        }
    }
    return target
}

function _number(a, len) { //用于模拟slice, splice的效果
    a = Math.floor(a) || 0
    return a < 0 ? Math.max(len + a, 0) : Math.min(a, len);
}
avalon.mix({
    rword: rword,
    subscribers: subscribers,
    version: 1.43,
    ui: {},
    log: log,
    slice: function (nodes, start, end) {
        return aslice.call(nodes, start, end)
    },
    noop: noop,
    /*如果不用Error对象封装一下，str在控制台下可能会乱码*/
    error: function (str, e) {
        throw new (e || Error)(str)// jshint ignore:line
    },
    /*将一个以空格或逗号隔开的字符串或数组,转换成一个键值都为1的对象*/
    oneObject: oneObject,
    /* avalon.range(10)
     => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
     avalon.range(1, 11)
     => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
     avalon.range(0, 30, 5)
     => [0, 5, 10, 15, 20, 25]
     avalon.range(0, -10, -1)
     => [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
     avalon.range(0)
     => []*/
    range: function (start, end, step) { // 用于生成整数数组
        step || (step = 1)
        if (end == null) {
            end = start || 0
            start = 0
        }
        var index = -1,
                length = Math.max(0, Math.ceil((end - start) / step)),
                result = new Array(length)
        while (++index < length) {
            result[index] = start
            start += step
        }
        return result
    },
    eventHooks: {},
    /*绑定事件*/
    bind: function (el, type, fn, phase) {
        console.warn("string-avalon不存在bind方法")
    },
    /*卸载事件*/
    unbind: function (el, type, fn, phase) {
        console.warn("string-avalon不存在unbind方法")
    },
    /*读写删除元素节点的样式*/
    css: function (node, name, value) {
        console.warn("string-avalon不存在css方法")
    },
    /*遍历数组与对象,回调的第一个参数为索引或键名,第二个或元素或键值*/
    each: function (obj, fn) {
        if (obj) { //排除null, undefined
            var i = 0
            if (isArrayLike(obj)) {
                for (var n = obj.length; i < n; i++) {
                    if (fn(i, obj[i]) === false)
                        break
                }
            } else {
                for (i in obj) {
                    if (obj.hasOwnProperty(i) && fn(i, obj[i]) === false) {
                        break
                    }
                }
            }
        }
    },
    //收集元素的data-{{prefix}}-*属性，并转换为对象
    getWidgetData: function (elem, prefix) {
        var raw = avalon(elem).data()
        var result = {}
        for (var i in raw) {
            if (i.indexOf(prefix) === 0) {
                result[i.replace(prefix, "").replace(/\w/, function (a) {
                    return a.toLowerCase()
                })] = raw[i]
            }
        }
        return result
    },
    Array: {
        /*只有当前数组不存在此元素时只添加它*/
        ensure: function (target, item) {
            if (target.indexOf(item) === -1) {
                return target.push(item)
            }
        },
        /*移除数组中指定位置的元素，返回布尔表示成功与否*/
        removeAt: function (target, index) {
            return !!target.splice(index, 1).length
        },
        /*移除数组中第一个匹配传参的那个元素，返回布尔表示成功与否*/
        remove: function (target, item) {
            var index = target.indexOf(item)
            if (~index)
                return avalon.Array.removeAt(target, index)
            return false
        }
    }
})

var bindingHandlers = avalon.bindingHandlers = {}
var bindingExecutors = avalon.bindingExecutors = {}

/*判定是否类数组，如节点集合，纯数组，arguments与拥有非负整数的length属性的纯JS对象*/
function isArrayLike(obj) {
    if (obj && typeof obj === "object") {
        var n = obj.length,
                str = serialize.call(obj)
        if (/(Array|List|Collection|Map|Arguments)\]$/.test(str)) {
            return true
        } else if (str === "[object Object]" && n === (n >>> 0)) {
            return true //由于ecma262v5能修改对象属性的enumerable，因此不能用propertyIsEnumerable来判定了
        }
    }
    return false
}
var DOM = {
    ids: {},
    getAttribute: function (elem, name) {
        var attrs = elem.attrs || []
        for (var i = 0, attr; attr = attrs[i++]; ) {
            if (attr.name === name)
                return attr.value
        }
    },
    nodeType: function (elem) {
        if (elem.nodeName === elem.tagName) {
            return 1
        }
        switch (elem.nodeName + "") {
            case "undefined":
                return 2
            case "#text":
                return 3
            case "#comment":
                return 8
            case "#document":
                return 9
            case "#document-type":
                return 10
            case "#document-fragment":
                return 11
        }
        return 2
    },
    hasAttribute: function (el, name) {
        var value = DOM.getAttribute(el, name)
        return typeof value === "string"
    },
    setAttribute: function (elem, key, value) {
        var attrs = elem.attrs || (elem.attrs = [])
        for (var i = 0; i < attrs.length; i++) {
            var attr = attrs[i]
            if (attr.name === key) {
                attr.value = value
                return elem
            }
        }
        attrs.push({
            name: key,
            value: value
        })
        return elem
    },
    setBoolAttribute: function (elem, name, value) {
        if (value) {
            DOM.setAttribute(elem, name, name)
        } else {
            DOM.removeAttribute(elem, name)
        }
    },
    removeAttribute: function (elem, name) {
        var attrs = elem.attrs || []
        for (var i = attrs.length, attr; attr = attrs[--i]; ) {
            if (attr.name === name) {
                attrs.splice(i, 1)
                break
            }
        }
        return elem
    },
    innerText: function (elem, text) {
        elem.childNodes = [
            {
                nodeName: "#text",
                nodeType: 3,
                value: text,
                parentNode: elem
            }
        ]
    },
    createElement: function (tagName) {
        return {
            nodeName: tagName,
            tagName: tagName,
            attrs: [],
            namespaceURI: 'http://www.w3.org/1999/xhtml',
            nodeType: 1,
            childNodes: []
        }
    },
    outerHTML: function (elem) {
        var serializer = new parse5.Serializer();
        var doc = {
            nodeName: "#document",
            quirksNode: false
        }
        elem.parentNode = doc
        doc.childNodes = [elem]
        return serializer.serialize(doc)
    },
    innerHTML: function (parent, html) {
        var fragment = parser.parseFragment(html)
        var nodes = fragment.childNodes
        for (var i = 0, node; node = nodes[i++]; ) {
            node.nodeType = DOM.nodeType(node)
            node.parentNode = parent
        }
        parent.childNodes = nodes
    },
    appendChild: function (parent, html) {
        var nodes = [].concat(html)
        for (var i = 0, node; node = nodes[i++]; ) {
            node.parentNode = parent
            node.nodeType = DOM.nodeType(node)
            parent.childNodes.push(node)
        }
    },
    replaceChild: function (newNode, oldNode) {
        var parent = oldNode.parentNode
        var childNodes = parent.childNodes
        var index = childNodes.indexOf(oldNode)
        if (!~index)
            return
        if (Array.isArray(newNode)) {
            var args = [index, 1]
            for (var i = 0, el; el = newNode[i++]; ) {
                el.parentNode = parent
                args.push(el)
            }
            Array.prototype.splice.apply(childNodes, args)
        } else {
            newNode.parentNode = parent
            Array.prototype.splice.apply(childNodes, [index, 1, newNode])
        }
    },
    removeChild: function (elem) {
        var children = elem.parentNode.childNodes
        var index = children.indexOf(elem)
        if (~index)
            children.splice(index, 1)
        return elem
    },
    createComment: function (data) {
        return {
            parentNode: null,
            nodeType: 8,
            nodeName: "#comment",
            data: data
        }
    }
}
avalon.parseHTML = function (html) {
    return parser.parseFragment(html)
}
avalon.innerHTML = function (parent, html) {
    if (parent.tagName)
        DOM.innerHTML(parent, html)
}
avalon.clearHTML = function (parent) {
    parent.childNodes.length = 0
}
/*********************************************************************
 *                        avalon的原型方法定义区                        *
 **********************************************************************/

function hyphen(target) {
    //转换为连字符线风格
    return target.replace(/([a-z\d])([A-Z]+)/g, "$1-$2").toLowerCase()
}

function camelize(target) {
    //转换为驼峰风格
    if (target.indexOf("-") < 0 && target.indexOf("_") < 0) {
        return target //提前判断，提高getStyle等的效率
    }
    return target.replace(/[-_][^-_]/g, function (match) {
        return match.charAt(1).toUpperCase()
    })
}

avalon.fn.mix({
    hasClass: function (cls) {
        var array = this.attr("class") || ""
        array = array.split(/\s+/)
        return array.indexOf(cls) !== -1
    },
    toggleClass: function (value, stateVal) {
        var className, i = 0
        var classNames = String(value).split(/\s+/)
        var isBool = typeof stateVal === "boolean"
        while ((className = classNames[i++])) {
            var state = isBool ? stateVal : !this.hasClass(className)
            this[state ? "addClass" : "removeClass"](className)
        }
        return this
    },
    addClass: function (cls) {
        var array = this.attr("class") || ""
        array = array.split(/\s+/)
        if (array.indexOf(cls) !== -1) {
            array.push(cls)
            this.attr("class", array.join(" ").trim())
        }
        return this
    },
    removeClass: function (cls) {
        var classes = this.attr("class") || ""
        classes = (" " + classes + " ").replace(" " + cls + " ", " ").trim()
        this.attr("class", classes)
        return this
    },
    attr: function (name, value) {
        if (arguments.length === 2) {
            DOM.setAttribute(this[0], name, value)
            return this
        } else {
            return DOM.getAttribute(this[0], name)
        }
    },
    data: function (name, value) {
        name = "data-" + hyphen(name || "")
        switch (arguments.length) {
            case 2:
                this.attr(name, value)
                return this
            case 1:
                var val = this.attr(name)
                return parseData(val)
            case 0:
                var ret = {}
               this[0].attrs.forEach(function (attr) {
                    if (attr) {
                        name = attr.name
                        if (!name.indexOf("data-")) {
                            name = camelize(name.slice(5))
                            ret[name] = parseData(attr.value)
                        }
                    }
                })
                return ret
        }
    },
    removeData: function (name) {
        name = "data-" + hyphen(name)
        this[0].removeAttribute(name)
        return this
    },
    css: function (name, value) {
        console.warn("string-avalon不存在fn.css方法")
    },
    position: function () {
        console.warn("string-avalon不存在fn.position方法")
    },
    offsetParent: function () {
        console.warn("string-avalon不存在fn.offsetParent方法")

    },
    bind: function (type, fn, phase) {
        console.warn("string-avalon不存在fn.bind方法")
    },
    unbind: function (type, fn, phase) {
        console.warn("string-avalon不存在fn.unbind方法")
        return this
    },
    val: function (value) {
        var node = this[0]
        if (node && DOM.nodeType(node) === 1) {
            var get = arguments.length === 0
            var access = get ? ":get" : ":set"
            var fn = valHooks[getValType(node) + access]
            if (fn) {
                var val = fn(node, value)
            } else if (get) {
                return (this.attr("value") || "").replace(/\r/g, "")
            } else {
                this.attr("value", String(value))
            }
        }
        return get ? val : this
    }
})


var rbrace = /(?:\{[\s\S]*\}|\[[\s\S]*\])$/
avalon.parseJSON = JSON.parse

function parseData(data) {
    try {
        if (typeof data === "object")
            return data
        data = data === "true" ? true :
                data === "false" ? false :
                data === "null" ? null : +data + "" === data ? +data : rbrace.test(data) ? JSON.parse(data) : data
    } catch (e) {
    }
    return data
}
avalon.each({
    scrollLeft: "pageXOffset",
    scrollTop: "pageYOffset"
}, function (method, prop) {
    avalon.fn[method] = function (val) {
        console.warn("string-avalon不存在fn." + method + "方法")
    }
})

//=============================css相关==================================
var cssHooks = avalon.cssHooks = createMap()
var prefixes = ["", "-webkit-", "-moz-", "-ms-"] //去掉opera-15的支持

avalon.cssNumber = {}
avalon.cssName = function (name, host, camelCase) {
    console.warn("string-avalon不存在avalon.cssName方法")
}

"Width,Height".replace(rword, function (name) { //fix 481
    var method = name.toLowerCase()
    avalon.fn[method] = function (value) { //会忽视其display
        console.warn("string-avalon不存在fn." + method + "方法")
    }
    avalon.fn["inner" + name] = function () {
        console.warn("string-avalon不存在fn.inner" + name + "方法")
    }
    avalon.fn["outer" + name] = function () {
        console.warn("string-avalon不存在fn.outer" + name + "方法")
    }
})
avalon.fn.offset = function () { //取得距离页面左右角的坐标
    console.warn("string-avalon不存在fn.offset方法")
    return {
        left: 0,
        top: 0
    }
}
//=============================val相关=======================

function getValType(elem) {
    var ret = elem.tagName.toLowerCase()
    return ret === "input" && /checkbox|radio/.test(DOM.getAttribute(elem, "type")) ? "checked" : ret
}

function collectSelectedOptions(children, array) {
    for (var i = 0, el; el = children[i++]; ) {
        if (el.nodeName.toUpperCase() === "OPTGROUP") {
            if (!isDisabled(el))
                collectSelectedOptions(el.childNodes || [], array)
        } else if (!isDisabled(el) && isSelected(el)) {
            array.push(getOptionValue(el))
        }
    }
}
function collectOptions(children, array) {
    for (var i = 0, el; el = children[i++]; ) {
        if (el.nodeName.toUpperCase() === "OPTGROUP") {
            collectOptions(el.childNodes, array)
        } else if (el.nodeName.toUpperCase() === "OPTION") {
            array.push(el)
        }
    }
}
function isDisabled(el) {
    return DOM.hasAttribute(el, "disabled")
}
function isSelected(el) {
    return DOM.hasAttribute(el, "selected")
}
function isSelectMultiple(el) {
    return DOM.hasAttribute(el, "multiple") || DOM.getAttribute(el, "type") === "select-multiple"
}

function getOptionValue(el) {
    var value = DOM.getAttribute(el, "value")
    if (typeof value === "string")
        return value
    var text = el.childNodes[0]
    if (text)
        return text.value
    return ""
}

var valHooks = {
    "select:get": function (node) {
        var array = []
        collectSelectedOptions(node.childNodes, array)
        var isMultiple = isSelectMultiple(node)
        return isMultiple ? array : array[0]
    },
    "select:set": function (node, values) {
        values = [].concat(values) //强制转换为数组
        var options = collectOptions(node.childNodes)
        var isMultiple = isSelectMultiple(node)
        var selectedIndex = -1
        for (var i = 0, el; el = options[i]; i++) {
            var value = getOptionValue(el)
            var toggle = values.indexOf(value) > -1
            if (toggle) {
                DOM.setAttribute(el, "selected", "selected")
                selectedIndex = i
            } else {
                DOM.removeAttribute(el, "selected")
            }
        }
        if (!isMultiple) {
            DOM.setAttribute(node, "selectedIndex", String(selectedIndex))
        }
    }
}
/*********************************************************************
 *                           扫描系统                                 *
 **********************************************************************/
avalon.scan = function(elem, vmodel) {
    var vmodels = vmodel ? [].concat(vmodel) : []
    scanTag(elem, vmodels)
}
//http://www.w3.org/TR/html5/syntax.html#void-elements
var stopScan = oneObject("area,base,basefont,br,col,command,embed,hr,img,input,link,meta,param,source,track,wbr,noscript,script,style,textarea")

    function executeBindings(bindings, vmodels) {
        for (var i = 0, data; data = bindings[i++];) {
            data.vmodels = vmodels
            bindingHandlers[data.type](data, vmodels)
            if (data.evaluator && data.element && data.element.tagName) { //移除数据绑定，防止被二次解析
                //chrome使用removeAttributeNode移除不存在的特性节点时会报错 https://github.com/RubyLouvre/avalon/issues/99
                DOM.removeAttribute(data.element, data.name)
                // data.element.removeAttribute(data.name)
            }
        }
        bindings.length = 0
    }

var rmsAttr = /ms-(\w+)-?(.*)/
var priorityMap = {
    "if": 10,
    "repeat": 90,
    "data": 100,
    "widget": 110,
    "each": 1400,
    "with": 1500,
    "duplex": 2000,
    "on": 3000
}

var events = oneObject("animationend,blur,change,input,click,dblclick,focus,keydown,keypress,keyup,mousedown,mouseenter,mouseleave,mousemove,mouseout,mouseover,mouseup,scan,scroll,submit")
var obsoleteAttrs = oneObject("value,title,alt,checked,selected,disabled,readonly,enabled")

    function bindingSorter(a, b) {
        return a.priority - b.priority
    }
    
var getBindingCallback = function(elem, name, vmodels) {
    var callback = DOM.getAttribute(elem,name)
    if (callback) {
        for (var i = 0, vm; vm = vmodels[i++]; ) {
            if (vm.hasOwnProperty(callback) && typeof vm[callback] === "function") {
                return vm[callback]
            }
        }
    }
}

function scanTag(elem, vmodels) {
    if (elem.tagName) {
        elem.nodeType = 1
        if (DOM.getAttribute(elem, "ms-skip"))
            return
        if (!DOM.getAttribute(elem, "ms-skip-ctrl")) {
            var ctrl = DOM.getAttribute(elem, "ms-important")
            if (ctrl) {
                elem.attrs.push({
                    name: "ms-skip-ctrl",
                    value: "true"
                })
                var isImporant = true
            } else {
                ctrl = DOM.getAttribute(elem, "ms-controller")
                if (ctrl) {
                    elem.attrs.push({
                        name: "ms-skip-ctrl",
                        value: "true"
                    })
                }
            }
            if (ctrl) {
                var newVmodel = avalon.vmodels[ctrl]
                if (!newVmodel) {
                    return
                }
                vmodels = isImporant ? [newVmodel] : [newVmodel].concat(vmodels)
            }
        }
        scanAttr(elem, vmodels)
    } else if (elem.nodeName === "#document") { //如果是文档
        scanNodeArray(elem.childNodes, vmodels)
    } else if (elem.nodeName === "#document-fragment") { //如果是文档文型
        scanNodeArray(elem.childNodes, vmodels)
    }
}
function scanNodeArray(nodes, vmodels) {
    for (var i = 0, node; node = nodes[i++]; ) {
        scanNode(node, vmodels)
    }
}
var scriptTypes = oneObject(["", "text/javascript", "text/ecmascript", "application/ecmascript", "application/javascript"])

function scanNode(node, vmodels) {
    switch (DOM.nodeType(node)) {
        case 3: //如果是文本节点
            node.nodeType = 3
            scanText(node, vmodels)
            break
        case 8: //如果是注释节点
            if (kernel.commentInterpolate) {
                node.nodeType = 8
                scanText(node, vmodels)
            }
            break
        case 1: //如果是元素节点
            node.nodeType = 1
            var id = DOM.getAttribute(node, "id")
            if (id) {
                switch (node.nodeName) {
                    case "script":
                        var type = DOM.getAttribute(node, "type")
                        if (type && !scriptTypes[type]) {
                            DOM.ids[id] = node.childNodes[0].value
                        }
                        break
                    case "textarea":
                    case "noscript":
                        DOM.ids[id] = node.childNodes[0].value
                        break
                }
            }
            scanTag(node, vmodels)
            break
    }
}
function scanAttr(elem, vmodels) {
    var attributes = elem.attrs || []
    var bindings = [],
            msData = {},
            match
    for (var i = attributes.length - 1; i >= 0; i--) {
        var attr = attributes[i]
        if (match = attr.name.match(rmsAttr)) {
            //如果是以指定前缀命名的
            var type = match[1]
            var param = match[2] || ""
            var value = attr.value
            var name = attr.name
            msData[name] = value
            if (events[type]) {
                param = type
                type = "on"
            } else if (obsoleteAttrs[type]) {
                log("warning!请改用ms-attr-" + type + "代替ms-" + type + "！")
                if (type === "enabled") {//吃掉ms-enabled绑定,用ms-disabled代替
                    log("warning!ms-enabled或ms-attr-enabled已经被废弃")
                    type = "disabled"
                    value = "!(" + value + ")"
                }
                param = type
                type = "attr"
                name = "ms-attr-" + param
                attributes.splice(i, 1, {name: name, value: value})
                match = [name]
                msData[name] = value
            }
            if (typeof bindingHandlers[type] === "function") {
                var binding = {
                    type: type,
                    param: param,
                    element: elem,
                    name: match[0],
                    value: value,
                    priority: type in priorityMap ? priorityMap[type] : type.charCodeAt(0) * 10 + (Number(param) || 0)
                }
                if (type === "html" || type === "text") {
                    var token = getToken(value)
                    avalon.mix(binding, token)
                    binding.filters = binding.filters.replace(rhasHtml, function () {
                        binding.type = "html"
                        binding.group = 1
                        return ""
                    })// jshint ignore:line
                }
                if (name === "ms-if-loop") {
                    binding.priority += 100
                }
                if (vmodels.length) {
                    bindings.push(binding)
                    if (type === "widget") {
                        elem.msData = elem.msData || msData
                    }
                }
            }
        }
    }
    bindings.sort(bindingSorter)
    var scanNode = true
    for (i = 0; binding = bindings[i]; i++) {
        type = binding.type
        if (rnoscanAttrBinding.test(type)) {
            return executeBindings(bindings.slice(0, i + 1), vmodels)
        } else if (scanNode) {
            scanNode = !rnoscanNodeBinding.test(type)
        }
    }
    executeBindings(bindings, vmodels)
    if (scanNode && !stopScan[elem.tagName]) {
        scanNodeArray(elem.childNodes, vmodels) //扫描子孙元素
    }
}
var rnoscanAttrBinding = /^if|widget|repeat$/
var rnoscanNodeBinding = /^each|with|html|include$/

var rhasHtml = /\|\s*html\s*/,
        r11a = /\|\|/g,
        rlt = /&lt;/g,
        rgt = /&gt;/g,
        rstringLiteral = /(['"])(\\\1|.)+?\1/g
function getToken(value) {
    if (value.indexOf("|") > 0) {
        var scapegoat = value.replace(rstringLiteral, function (_) {
            return Array(_.length + 1).join("1")// jshint ignore:line
        })
        var index = scapegoat.replace(r11a, "\u1122\u3344").indexOf("|") //干掉所有短路或
        if (index > -1) {
            return {
                filters: value.slice(index),
                value: value.slice(0, index),
                expr: true
            }
        }
    }
    return {
        value: value,
        filters: "",
        expr: true
    }
}

function scanExpr(str) {
    var tokens = [],
            value, start = 0,
            stop
    do {
        stop = str.indexOf(openTag, start)
        if (stop === -1) {
            break
        }
        value = str.slice(start, stop)
        if (value) { // {{ 左边的文本
            tokens.push({
                value: value,
                filters: "",
                expr: false
            })
        }
        start = stop + openTag.length
        stop = str.indexOf(closeTag, start)
        if (stop === -1) {
            break
        }
        value = str.slice(start, stop)
        if (value) { //处理{{ }}插值表达式
            tokens.push(getToken(value))
        }
        start = stop + closeTag.length
    } while (1)
    value = str.slice(start)
    if (value) { //}} 右边的文本
        tokens.push({
            value: value,
            expr: false,
            filters: ""
        })
    }
    return tokens
}

function scanText(textNode, vmodels) {
    var bindings = []
    if (textNode.nodeType === 8) {
        var token = getToken(textNode.data)//在parse5中注释节点的值用data来取
        var tokens = [token]
    } else {
        tokens = scanExpr(textNode.value)//在parse5中文本节点的值用value来取
    }
    if (tokens.length) {
        var fragment = []
        fragment.appendChild = function (node) {
            this.push(node)
        }
        for (var i = 0; token = tokens[i++]; ) {
            var node = {
                nodeName: "#text",
                value: token.value,
                nodeType: 3
            } //将文本转换为文本节点，并替换原来的文本节点
            if (token.expr) {
                token.type = "text"
                token.element = node
                token.filters = token.filters.replace(rhasHtml, function () {
                    token.type = "html"
                    token.group = 1
                    return ""
                })// jshint ignore:line
                bindings.push(token) //收集带有插值表达式的文本
            }
            fragment.appendChild(node)
        }
        DOM.replaceChild(fragment, textNode)
        if (bindings.length)
            executeBindings(bindings, vmodels)
    }
}
/*********************************************************************
 *                          编译系统                                  *
 **********************************************************************/
var quote = JSON.stringify
var keywords = [
    "break,case,catch,continue,debugger,default,delete,do,else,false",
    "finally,for,function,if,in,instanceof,new,null,return,switch,this",
    "throw,true,try,typeof,var,void,while,with", /* 关键字*/
    "abstract,boolean,byte,char,class,const,double,enum,export,extends",
    "final,float,goto,implements,import,int,interface,long,native",
    "package,private,protected,public,short,static,super,synchronized",
    "throws,transient,volatile", /*保留字*/
    "arguments,let,yield,undefined" /* ECMA 5 - use strict*/].join(",")
var rrexpstr = /\/\*[\w\W]*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$|"(?:[^"\\]|\\[\w\W])*"|'(?:[^'\\]|\\[\w\W])*'|[\s\t\n]*\.[\s\t\n]*[$\w\.]+/g
var rsplit = /[^\w$]+/g
var rkeywords = new RegExp(["\\b" + keywords.replace(/,/g, '\\b|\\b') + "\\b"].join('|'), 'g')
var rnumber = /\b\d[^,]*/g
var rcomma = /^,+|,+$/g
var cacheVars = new Cache(512)
var getVariables = function (code) {
    var key = "," + code.trim()
    var ret = cacheVars.get(key)
    if (ret) {
        return ret
    }
    var match = code
            .replace(rrexpstr, "")
            .replace(rsplit, ",")
            .replace(rkeywords, "")
            .replace(rnumber, "")
            .replace(rcomma, "")
            .split(/^$|,+/)
    return cacheVars.put(key, uniqSet(match))
}
/*添加赋值语句*/

function addAssign(vars, scope, name, data) {
    var ret = [],
            prefix = " = " + name + "."
    for (var i = vars.length, prop; prop = vars[--i]; ) {
        if (scope.hasOwnProperty(prop)) {
            ret.push(prop + prefix + prop)
            data.vars.push(prop)
            if (data.type === "duplex") {
                console.log("不存在duplex绑定对象")
               // vars.get = name + "." + prop
            }
            vars.splice(i, 1)
        }
    }
    return ret
}

function uniqSet(array) {
    var ret = [],
            unique = {}
    for (var i = 0; i < array.length; i++) {
        var el = array[i]
        var id = el && typeof el.$id === "string" ? el.$id : el
        if (!unique[id]) {
            unique[id] = ret.push(el)
        }
    }
    return ret
}
//缓存求值函数，以便多次利用
var cacheExprs = new Cache(128)
//取得求值函数及其传参
var rduplex = /\w\[.*\]|\w\.\w/
var rproxy = /(\$proxy\$[a-z]+)\d+$/
var rthimRightParentheses = /\)\s*$/
var rthimOtherParentheses = /\)\s*\|/g
var rquoteFilterName = /\|\s*([$\w]+)/g
var rpatchBracket = /"\s*\["/g
var rthimLeftParentheses = /"\s*\(/g
function parseFilter(val, filters) {
    filters = filters
            .replace(rthimRightParentheses, "")//处理最后的小括号
            .replace(rthimOtherParentheses, function () {//处理其他小括号
                return "],|"
            })
            .replace(rquoteFilterName, function (a, b) { //处理|及它后面的过滤器的名字
                return "[" + quote(b)
            })
            .replace(rpatchBracket, function () {
                return '"],["'
            })
            .replace(rthimLeftParentheses, function () {
                return '",'
            }) + "]"
    return  "return avalon.filters.$filter(" + val + ", " + filters + ")"
}

function parseExpr(code, scopes, data) {
    var dataType = data.type
    var filters = data.filters || ""
    var exprId = scopes.map(function (el) {
        return String(el.$id).replace(rproxy, "$1")
    }) + code + dataType + filters
    var vars = getVariables(code).concat(),
            assigns = [],
            names = [],
            args = [],
            prefix = ""
    //args 是一个对象数组， names 是将要生成的求值函数的参数
    scopes = uniqSet(scopes)
    data.vars = []
    for (var i = 0, sn = scopes.length; i < sn; i++) {
        if (vars.length) {
            var name = "vm" + expose + "_" + i
            names.push(name)
            args.push(scopes[i])
            assigns.push.apply(assigns, addAssign(vars, scopes[i], name, data))
        }
    }
    if (!assigns.length && dataType === "duplex") {
        return
    }
    if (dataType !== "duplex" && (code.indexOf("||") > -1 || code.indexOf("&&") > -1)) {
        //https://github.com/RubyLouvre/avalon/issues/583
        data.vars.forEach(function (v) {
            var reg = new RegExp("\\b" + v + "(?:\\.\\w+|\\[\\w+\\])+", "ig")
            code = code.replace(reg, function (_) {
                var c = _.charAt(v.length)
                var r =  RegExp.rightContext
                var method = /^\s*\(/.test(r)
                if (c === "." || c === "[" || method) {//比如v为aa,我们只匹配aa.bb,aa[cc],不匹配aaa.xxx
                    var name = "var" + String(Math.random()).replace(/^0\./, "")
                    if (method) {//array.size()
                        var array = _.split(".")
                        if (array.length > 2) {
                            var last = array.pop()
                            assigns.push(name + " = " + array.join("."))
                            return name + "." + last
                        } else {
                            return _
                        }
                    }
                    assigns.push(name + " = " + _)
                    return name
                } else {
                    return _
                }
            })
        })
    }
    //---------------args----------------
    data.args = args
    //---------------cache----------------
    var fn = cacheExprs.get(exprId) //直接从缓存，免得重复生成
    if (fn) {
        data.evaluator = fn
        return
    }
    prefix = assigns.join(", ")
    if (prefix) {
        prefix = "var " + prefix
    }
    if (/\S/.test(filters)) { //文本绑定，双工绑定才有过滤器
        if (!/text|html/.test(data.type)) {
            throw Error("ms-" + data.type + "不支持过滤器")
        }
        code = "\nvar ret" + expose + " = " + code + ";\r\n"
        code += parseFilter("ret" + expose, filters)
    } else if (dataType === "duplex") { //双工绑定
        var _body = "'use strict';\nreturn function(vvv){\n\t" +
                prefix +
                ";\n\tif(!arguments.length){\n\t\treturn " +
                code +
                "\n\t}\n\t" + (!rduplex.test(code) ? vars.get : code) +
                "= vvv;\n} "
        try {
            fn = Function.apply(noop, names.concat(_body))
            data.evaluator = cacheExprs.put(exprId, fn)
        } catch (e) {
            log("debug: parse error," + e.message)
        }
        return
    } else if (dataType === "on") { //事件绑定
        if (code.indexOf("(") === -1) {
            code += ".call(this, $event)"
        } else {
            code = code.replace("(", ".call(this,")
        }
        names.push("$event")
        code = "\nreturn " + code + ";" //IE全家 Function("return ")出错，需要Function("return ;")
        var lastIndex = code.lastIndexOf("\nreturn")
        var header = code.slice(0, lastIndex)
        var footer = code.slice(lastIndex)
        code = header + "\n" + footer
    } else { //其他绑定
        code = "\nreturn " + code + ";" //IE全家 Function("return ")出错，需要Function("return ;")
    }
    try {
        fn = Function.apply(noop, names.concat("'use strict';\n" + prefix + code))
        data.evaluator = cacheExprs.put(exprId, fn)
    } catch (e) {
        log("debug: parse error," + e.message)
    } finally {
        vars = assigns = names = null //释放内存
    }
}


//parseExpr的智能引用代理

function parseExprProxy(code, scopes, data, tokens, noregister) {
    if (Array.isArray(tokens)) {
        code = tokens.map(function (el) {
            return el.expr ? "(" + el.value + ")" : quote(el.value)
        }).join(" + ")
    }
    parseExpr(code, scopes, data)
    if (data.evaluator && !noregister) {
        data.handler = bindingExecutors[data.handlerName || data.type]
        //方便调试
        //这里非常重要,我们通过判定视图刷新函数的element是否在DOM树决定
        //将它移出订阅者列表
        registerSubscriber(data)
    }
}
avalon.parseExprProxy = parseExprProxy
/*********************************************************************
 *                            事件总线                               *
 **********************************************************************/
var EventBus = {
    $watch: function(type, callback) {
        if (typeof callback === "function") {
            var callbacks = this.$events[type]
            if (callbacks) {
                callbacks.push(callback)
            } else {
                this.$events[type] = [callback]
            }
        } else { //重新开始监听此VM的第一重简单属性的变动
            this.$events = this.$watch.backup
        }
        return this
    },
    $unwatch: function(type, callback) {
        var n = arguments.length
        if (n === 0) { //让此VM的所有$watch回调无效化
            this.$watch.backup = this.$events
            this.$events = {}
        } else if (n === 1) {
            this.$events[type] = []
        } else {
            var callbacks = this.$events[type] || []
            var i = callbacks.length
            while (~--i < 0) {
                if (callbacks[i] === callback) {
                    return callbacks.splice(i, 1)
                }
            }
        }
        return this
    },
    $fire: function(type) {
        var special, i, v, callback
        if (/^(\w+)!(\S+)$/.test(type)) {
            special = RegExp.$1
            type = RegExp.$2
        }
        var events = this.$events
        if (!events)
            return
        var args = aslice.call(arguments, 1)
        var detail = [type].concat(args)
        if (special === "all") {
            for (i in avalon.vmodels) {
                v = avalon.vmodels[i]
                if (v !== this) {
                    v.$fire.apply(v, detail)
                }
            }
        } else if (special === "up" || special === "down") {
            console.warin("不支持$fire(up!xxx)")
        } else {
            var callbacks = events[type] || []
            var all = events.$all || []
            for (i = 0; callback = callbacks[i++];) {
                if (isFunction(callback))
                    callback.apply(this, args)
            }
            for (i = 0; callback = all[i++];) {
                if (isFunction(callback))
                    callback.apply(this, arguments)
            }
        }
    }
}
/*********************************************************************
 *                           modelFactory                             *
 **********************************************************************/
//avalon最核心的方法的两个方法之一（另一个是avalon.scan），返回一个ViewModel(VM)
var VMODELS = avalon.vmodels = createMap() //所有vmodel都储存在这里
avalon.define = function (id, factory) {
    var $id = id.$id || id
    if (!$id) {
        log("warning: vm必须指定$id")
    }
    if (VMODELS[$id]) {
        log("warning: " + $id + " 已经存在于avalon.vmodels中")
    }
    if (typeof id === "object") {
        var model = modelFactory(id)
    } else {
        var scope = {
            $watch: noop
        }
        factory(scope) //得到所有定义
        model = modelFactory(scope) //偷天换日，将scope换为model
        stopRepeatAssign = true
        factory(model)
        stopRepeatAssign = false
    }
    model.$id = $id
    return VMODELS[$id] = model
}

//一些不需要被监听的属性
var $$skipArray = String("$id,$watch,$unwatch,$fire,$events,$model,$skipArray").match(rword)

function isObservable(name, value, $skipArray) {
    if (isFunction(value) || value && value.nodeType) {
        return false
    }
    if ($skipArray.indexOf(name) !== -1) {
        return false
    }
    if ($$skipArray.indexOf(name) !== -1) {
        return false
    }
    var $special = $skipArray.$special
    if (name && name.charAt(0) === "$" && !$special[name]) {
        return false
    }
    return true
}
//ms-with,ms-each, ms-repeat绑定生成的代理对象储存池
var midway = createMap()
function getNewValue(accessor, name, value, $vmodel) {
    switch (accessor.type) {
        case 0://计算属性
            var getter = accessor.get
            var setter = accessor.set
            if (isFunction(setter)) {
                var $events = $vmodel.$events
                var lock = $events[name]
                $events[name] = [] //清空回调，防止内部冒泡而触发多次$fire
                setter.call($vmodel, value)
                $events[name] = lock
            }
            return  getter.call($vmodel) //同步$model
        case 1://监控属性
            return value
        case 2://对象属性（包括数组与哈希）
            if (value !== $vmodel.$model[name]) {
                var svmodel = accessor.svmodel = objectFactory($vmodel, name, value, accessor.valueType)
                value = svmodel.$model //同步$model
                var fn = midway[svmodel.$id]
                fn && fn() //同步视图
            }
            return value
    }
}

function modelFactory(source, $special, $model) {
    if (Array.isArray(source)) {
        var arr = source.concat()
        source.length = 0
        var collection = Collection(source)// jshint ignore:line
        collection.pushArray(arr)
        return collection
    }
    //0 null undefined || Node || VModel
    if (!source || source.nodeType > 0 || (source.$id && source.$events)) {
        return source
    }
    if (!Array.isArray(source.$skipArray)) {
        source.$skipArray = []
    }
    source.$skipArray.$special = $special || createMap() //强制要监听的属性
    var $vmodel = {} //要返回的对象, 它在IE6-8下可能被偷龙转凤
    $model = $model || {} //vmodels.$model属性
    var $events = createMap() //vmodel.$events属性
    var watchedProperties = createMap() //监控属性
    var initCallbacks = [] //初始化才执行的函数
    for (var i in source) {
        (function (name, val) {
            $model[name] = val
            if (!isObservable(name, val, source.$skipArray)) {
                return //过滤所有非监控属性
            }
            //总共产生三种accessor
            $events[name] = []
            var valueType = avalon.type(val)
            var accessor = function (newValue) {
                var name = accessor._name
                var $vmodel = this
                var $model = $vmodel.$model
                var oldValue = $model[name]
                var $events = $vmodel.$events

                if (arguments.length) {
                    if (stopRepeatAssign) {
                        return
                    }
                    //计算属性与对象属性需要重新计算newValue
                    if (accessor.type !== 1) {
                        newValue = getNewValue(accessor, name, newValue, $vmodel)
                        if (!accessor.type)
                            return
                    }
                    if (!isEqual(oldValue, newValue)) {
                        $model[name] = newValue
                        notifySubscribers($events[name]) //同步视图
                        safeFire($vmodel, name, newValue, oldValue) //触发$watch回调
                    }
                } else {
                    if (accessor.type === 0) { //type 0 计算属性 1 监控属性 2 对象属性
                        //计算属性不需要收集视图刷新函数,都是由其他监控属性代劳
                        newValue = accessor.get.call($vmodel)
                        if (oldValue !== newValue) {
                            $model[name] = newValue
                            //这里不用同步视图
                            safeFire($vmodel, name, newValue, oldValue) //触发$watch回调
                        }
                        return newValue
                    } else {
                        collectSubscribers($events[name]) //收集视图函数
                        return accessor.svmodel || oldValue
                    }
                }
            }
            //总共产生三种accessor
            if (valueType === "object" && isFunction(val.get) && Object.keys(val).length <= 2) {
                //第1种为计算属性， 因变量，通过其他监控属性触发其改变
                accessor.set = val.set
                accessor.get = val.get
                accessor.type = 0
                initCallbacks.push(function () {
                    var data = {
                        evaluator: function () {
                            data.type = Math.random(),
                                    data.element = null
                            $model[name] = accessor.get.call($vmodel)
                        },
                        element: {nodeType: 1},
                        type: Math.random(),
                        handler: noop,
                        args: []
                    }
                    Registry[expose] = data
                    accessor.call($vmodel)
                    delete Registry[expose]
                })
            } else if (rcomplexType.test(valueType)) {
                //第2种为对象属性，产生子VM与监控数组
                accessor.type = 2
                accessor.valueType = valueType
                initCallbacks.push(function () {
                    var svmodel = modelFactory(val, 0, $model[name])
                    accessor.svmodel = svmodel
                    svmodel.$events[subscribers] = $events[name]
                })
            } else {
                accessor.type = 1
                //第3种为监控属性，对应简单的数据类型，自变量
            }
            accessor._name = name
            watchedProperties[name] = accessor
        })(i, source[i])// jshint ignore:line
    }

    $$skipArray.forEach(function (name) {
        delete source[name]
        delete $model[name] //这些特殊属性不应该在$model中出现
    })

    $vmodel = Object.defineProperties($vmodel, descriptorFactory(watchedProperties), source) //生成一个空的ViewModel
    for (var name in source) {
        if (!watchedProperties[name]) {
            $vmodel[name] = source[name]
        }
    }
    //添加$id, $model, $events, $watch, $unwatch, $fire
    $vmodel.$id = generateID()
    $vmodel.$model = $model
    $vmodel.$events = $events
    for (i in EventBus) {
        $vmodel[i] = EventBus[i]
    }

    Object.defineProperty($vmodel, "hasOwnProperty", {
        value: function (name) {
            return name in this.$model
        },
        writable: false,
        enumerable: false,
        configurable: true
    })

    initCallbacks.forEach(function (cb) { //收集依赖
        cb()
    })
    return $vmodel
}

//比较两个值是否相等
var isEqual = Object.is || function (v1, v2) {
    if (v1 === 0 && v2 === 0) {
        return 1 / v1 === 1 / v2
    } else if (v1 !== v1) {
        return v2 !== v2
    } else {
        return v1 === v2
    }
}

function safeFire(a, b, c, d) {
    if (a.$events) {
        EventBus.$fire.call(a, b, c, d)
    }
}

var descriptorFactory = function (obj) {
    var descriptors = createMap()
    for (var i in obj) {
        descriptors[i] = {
            get: obj[i],
            set: obj[i],
            enumerable: true,
            configurable: true
        }
    }
    return descriptors
}

//应用于第2种accessor
function objectFactory(parent, name, value, valueType) {
    //a为原来的VM， b为新数组或新对象
    var son = parent[name]
    if (valueType === "array") {
        if (!Array.isArray(value) || son === value) {
            return son //fix https://github.com/RubyLouvre/avalon/issues/261
        }
        son._.$unwatch()
        son.clear()
        son._.$watch()
        son.pushArray(value.concat())
        return son
    } else {
        var iterators = parent.$events[name]
        var pool = son.$events.$withProxyPool
        if (pool) {
            recycleProxies(pool, "with")
            son.$events.$withProxyPool = null
        }
        var ret = modelFactory(value)
        ret.$events[subscribers] = iterators
        midway[ret.$id] = function (data) {
            while (data = iterators.shift()) {
                (function (el) {
                    avalon.nextTick(function () {
                        var type = el.type
                        if (type && bindingHandlers[type]) { //#753
                            el.rollback && el.rollback() //还原 ms-with ms-on
                            bindingHandlers[type](el, el.vmodels)
                        }
                    })
                })(data)// jshint ignore:line
            }
            delete midway[ret.$id]
        }
        return ret
    }
}
/*********************************************************************
 *                           依赖调度系统                             *
 **********************************************************************/
var ronduplex = /^(duplex|on)$/

function registerSubscriber(data) {
    Registry[expose] = data //暴光此函数,方便collectSubscribers收集
    avalon.openComputedCollect = true
    var fn = data.evaluator
    if (fn) { //如果是求值函数
        try {
            var c = ronduplex.test(data.type) ? data : fn.apply(0, data.args)
            data.handler(c, data.element, data)
        } catch (e) {
           //log("warning:exception throwed in [registerSubscriber] " + e)
            delete data.evaluator
            var node = data.element
            if (node.nodeType === 3) {
                var parent = node.parentNode
                if (kernel.commentInterpolate) {
                    DOM.replaceChild({
                        nodeName: "#comment",
                        data: data.value,
                        parentNode:parent
                    }, node)
                } else {
                    node.value = openTag + data.value + closeTag
                }
            }
        }
    }
    avalon.openComputedCollect = false
    delete Registry[expose]
}

function collectSubscribers(list) { //收集依赖于这个访问器的订阅者
    var data = Registry[expose]
    if (list && data && avalon.Array.ensure(list, data) && data.element) { //只有数组不存在此元素才push进去
     //   addSubscribers(data, list)
    }
}


function addSubscribers(data, list) {
    data.$uuid = data.$uuid || generateID()
    list.$uuid = list.$uuid || generateID()
    var obj = {
        data: data,
        list: list,
        $$uuid:  data.$uuid + list.$uuid
    }
    if (!$$subscribers[obj.$$uuid]) {
        $$subscribers[obj.$$uuid] = 1
        $$subscribers.push(obj)
    }
}
var $$subscribers =[]
function disposeData(data) {
    data.element = null
    data.rollback && data.rollback()
    for (var key in data) {
        data[key] = null
    }
}

function removeSubscribers() {

}

function notifySubscribers(list) { //通知依赖于这个访问器的订阅者更新自身
    if (list && list.length) {
      
        var args = aslice.call(arguments, 1)
        for (var i = list.length, fn; fn = list[--i]; ) {
            var el = fn.element
            if (el && el.parentNode) {
                if (fn.$repeat) {
                    fn.handler.apply(fn, args) //处理监控数组的方法
                } else if (fn.type !== "on") { //事件绑定只能由用户触发,不能由程序触发
                    var fun = fn.evaluator || noop
                    fn.handler(fun.apply(0, fn.args || []), el, fn)
                }
            }
        }
    }
}

bindingHandlers.text = function(data, vmodels) {
	parseExprProxy(data.value, vmodels, data)
}
bindingExecutors.text = function(val, elem) {
	val = val == null ? "" : val //不在页面上显示undefined null
	if (elem.nodeName === "#text") { //绑定在文本节点上
		elem.value = val
	} else { //绑定在特性节点上
		DOM.innerText(elem, val)
	}
}
bindingHandlers.html = function(data, vmodels) {
    parseExprProxy(data.value, vmodels, data)
}
bindingExecutors.html = function(val, elem, data) {
    val = val == null ? "" : val
    var isHtmlFilter = "group" in data
    var parent = isHtmlFilter ? elem.parentNode : elem
    if (!parent)
        return
    if (typeof val === "string") {
        var nodes = avalon.parseHTML(val).childNodes
    } else if (val) {
        if (DOM.nodeType(val) === 11) { //将val转换为文档碎片
            nodes = val.childNodes
        } else if (DOM.nodeType(val) === 1) {
            nodes = val.childNodes
        } else {
            nodes = []
        }
    }

    if (!nodes.length) {
        nodes.push(DOM.createComment("ms-html"))
    }
    var args = nodes.map(function(node) {
        node.parentNode = parent
        return node
    })
    var children = parent.childNodes
    //插入占位符, 如果是过滤器,需要有节制地移除指定的数量,如果是html指令,直接清空
    if (isHtmlFilter) {
        data.group = nodes.length
        data.element = nodes[0]

        var index = children.indexOf(elem)
        args.unshift(index, data.group)
        Array.prototype.splice.apply(children, args)
    } else {
        args.unshift(index, children.length)
        Array.prototype.splice.apply(children, args)
    }
    scanNodeArray(nodes, data.vmodels)
}
//这里提供了所有特殊display的元素 http://www.htmldog.com/reference/cssproperties/display/
var specialDisplay = {
    table: "table",
    td: "table-cell",
    th: "table-cell",
    tr: "table-row",
    li: "list-item",
    thead: "table-header-group",
    tfoot: "table-footer-group",
    tbody: "table-row-group",
    colgroup: "table-column-group",
    col: "table-column",
    caption: "caption"
}
var rdisplay = /display\s*\:\s*([\w-]+)\s*;?/
bindingHandlers.visible = function (data, vmodels) {
    var elem = data.element
    //http://stackoverflow.com/questions/8228980/reset-css-display-property-to-default-value
    var style = DOM.getAttribute(elem, "style")
    if (style) { //如果用户在元素上设置了display
        var array = style.match(rdisplay) || []
        if (array[1]) {
            data.display = array[1]
        }
    }
    parseExprProxy(data.value, vmodels, data)
}

bindingExecutors.visible = function (val, elem, data) {
    var style = DOM.getAttribute(elem, "style")
    if (val) { //如果要显示,如果在元素设置display:none,那么就去掉
        if (style && data.display) {
            var replaced = data.display === "none" ? "" : data.display
            DOM.setAttribute(elem, "style", style.replace(rdisplay, replaced))
        }
    } else {  //如果要隐藏
        var cssText = !style ? "style:none;" : style.replace(rdisplay, "display:none;")
        DOM.setAttribute(elem, "style", cssText)
    }
}
bindingHandlers["data"] = bindingHandlers["if"] = function (data, vmodels) {
    parseExprProxy(data.value, vmodels, data)
}

bindingExecutors["if"] = function (val, elem, data) {
    if (val) { //插回DOM树
        if (elem.nodeName === "#comment") {
            var node = parser.parseFragment(elem.data).childNodes[0]
            var parent = elem.parentNode
            node.nodeType = 1
            node.parentNode = parent
            var children = elem.childNodes
            var index = children.indexOf(elem)
            children.splice(index, 1, node)
            elem = data.element = node
        }
        if (DOM.getAttribute(elem, data.name)) {
            DOM.removeAttribute(elem, data.name)
            scanAttr(elem, data.vmodels)
        }
    } else { //移出DOM树，并用注释节点占据原位置
        if (elem.tagName) {
            var parent = elem.parentNode
            var children = parent.childNodes
            var node = DOM.createComment(DOM.outerHTML(elem))
            node.nodeType = 8
            node.parentNode = parent
            var index = children.indexOf(elem)
            children.splice(index, 1, node)
            data.element = node
        }
    }
}

var bools = ["autofocus,autoplay,async,allowTransparency,checked,controls",
    "declare,disabled,defer,defaultChecked,defaultSelected",
    "contentEditable,isMap,loop,multiple,noHref,noResize,noShade",
    "open,readOnly,selected"
].join(",")
var boolMap = {}
bools.replace(rword, function (name) {
    boolMap[name.toLowerCase()] = name
})


var cacheTmpls = avalon.templateCache = {}

bindingHandlers.attr = function (data, vmodels) {
    var text = data.value.trim(),
            simple = true
    if (text.indexOf(openTag) > -1 && text.indexOf(closeTag) > 2) {
        simple = false
        if (rexpr.test(text) && RegExp.rightContext === "" && RegExp.leftContext === "") {
            simple = true
            text = RegExp.$1
        }
    }
    if (data.type === "include") {
        var elem = data.element
        data.includeRendered = getBindingCallback(elem, "data-include-rendered", vmodels)
        data.includeLoaded = getBindingCallback(elem, "data-include-loaded", vmodels)
        var outer = data.includeReplace = !!avalon(elem).data("includeReplace")
        if (avalon(elem).data("includeCache")) {
            data.templateCache = {}
        }
        data.startInclude = DOM.createComment("ms-include")
        data.endInclude = DOM.createComment("ms-include-end")
        DOM.removeAttribute(elem, data.name)
        if (outer) {
            var parent = elem.parentNode
            data.startInclude.parentNode = data.endInclude.parentNode = parent
            var children = parent.childNodes
            var index = children.indexOf(elem)
            data.element = data.startInclude
            children.splice(index, 1, data.startInclude, elem, data.endInclude)
        } else {
            data.startInclude.parentNode = data.endInclude.parentNode = elem
            var children = elem.childNodes
            children.unshift(data.startInclude)
            children.push(data.endInclude)
        }
    }
    data.handlerName = "attr" //handleName用于处理多种绑定共用同一种bindingExecutor的情况
    parseExprProxy(text, vmodels, data, (simple ? 0 : scanExpr(data.value)))
}
bindingExecutors.attr = function (val, elem, data) {
    var method = data.type
    var attrName = data.param
    if (method === "attr") {
        // ms-attr-class="xxx" vm.xxx="aaa bbb ccc"将元素的className设置为aaa bbb ccc
        // ms-attr-class="xxx" vm.xxx=false  清空元素的所有类名
        // ms-attr-name="yyy"  vm.yyy="ooo" 为元素设置name属性
        var toRemove = (val === false) || (val === null) || (val === void 0)
        if (boolMap[attrName]) {
            if (!val) {
                toRemove = true
            } else {
                return DOM.setAttribute(elem, attrName, attrName)
            }
        }
        if (toRemove) {
            return DOM.removeAttribute(elem, attrName)
        }
        DOM.setAttribute(elem, attrName, val)
    } else if (method === "include" && val) {
        var vmodels = data.vmodels
        var rendered = data.includeRendered
        var loaded = data.includeLoaded
        var replace = data.includeReplace
        var target = replace ? elem.parentNode : elem
        var scanTemplate = function (text) {
            if (loaded) {
                var newText = loaded.apply(target, [text].concat(vmodels))
                if (typeof newText === "string")
                    text = newText
            }
            if (rendered) {
                console.log("不支持data-include-rendered")
            }
            var parent = data.startInclude.parentNode
            var children = parent.childNodes
            var startIndex = children.indexOf(data.startInclude)+ 1
            var endIndex = children.indexOf(data.endInclude)
            children.splice(startIndex , endIndex - startIndex)
            var nodes = avalon.parseHTML(text).childNodes
            nodes.forEach(function (el) {
                el.parentNode = parent
            })
            var args = [startIndex, 0].concat(nodes)
            Array.prototype.splice.apply(children, args)
            scanNodeArray(nodes, vmodels)
        }
        var path = require("path")
        if (data.param === "src") {
            if (typeof cacheTmpls[val] === "string") {
                scanTemplate(cacheTmpls[val])
            } else {
                var filePath = path.resolve(process.cwd(), val)
                var text = require("fs").readFileSync(filePath, "utf8")
                scanTemplate(cacheTmpls[val] = text)
            }
        } else {
            //现在只在scanNode中收集拥有id的script, textarea, noscript标签的innerText
            scanTemplate(DOM.ids[val])
        }
    } else {
        DOM.setAttribute(elem, method, val) //ms-href, ms-src
    }
}

//这几个指令都可以使用插值表达式，如ms-src="aaa/{{b}}/{{c}}.html"ms-src
"title,alt,src,value,include,href".replace(rword, function (name) {
    bindingHandlers[name] = bindingHandlers.attr
})
// bindingHandlers.data 定义在if.js
bindingExecutors.data = function(val, elem, data) {
    var key = "data-" + data.param
    if (val && typeof val === "object") {
        console.warn("ms-data对应的值必须是简单数据类型")
    } else {
        DOM.setAttribute(elem, key, String(val))
    }
}

//双工绑定
var duplexBinding = bindingHandlers.duplex = function (data, vmodels) {
    var elem = data.element,
            hasCast
    var params = []
    var casting = oneObject("string,number,boolean,checked")
    if (elem.type === "radio" && data.param === "") {
        data.param = "checked"
    }
    if (elem.msData) {
        elem.msData["ms-duplex"] = data.value
    }
    data.param.replace(/\w+/g, function (name) {
        if (/^(checkbox|radio)$/.test(elem.type) && /^(radio|checked)$/.test(name)) {
            if (name === "radio")
                log("ms-duplex-radio已经更名为ms-duplex-checked")
            name = "checked"
            data.isChecked = true
        }
        if (name === "bool") {
            name = "boolean"
            log("ms-duplex-bool已经更名为ms-duplex-boolean")
        } else if (name === "text") {
            name = "string"
            log("ms-duplex-text已经更名为ms-duplex-string")
        }
        if (casting[name]) {
            hasCast = true
        }
        avalon.Array.ensure(params, name)
    })
    if (!hasCast) {
        params.push("string")
    }
    data.param = params.join("-")
    data.pipe = pipe
    parseExprProxy(data.value, vmodels, data)
}
//不存在 bindingExecutors.duplex
function fixNull(val) {
    return val == null ? "" : val
}
avalon.duplexHooks = {
    checked: {
        get: function (val, data) {
            return !data.element.oldValue
        }
    },
    string: {
        get: function (val) { //同步到VM
            return val
        },
        set: fixNull
    },
    "boolean": {
        get: function (val) {
            return val === "true"
        },
        set: fixNull
    },
    number: {
        get: function (val, data) {
            var number = parseFloat(val)
            if (-val === -number) {
                return number
            }
            var arr = /strong|medium|weak/.exec(DOM.getAttribute(data.element, "data-duplex-number")) || ["medium"]
            switch (arr[0]) {
                case "strong":
                    return 0
                case "medium":
                    return val === "" ? "" : 0
                case "weak":
                    return val
            }
        },
        set: fixNull
    }
}

function pipe(val, data, action, e) {
    data.param.replace(/\w+/g, function (name) {
        var hook = avalon.duplexHooks[name]
        if (hook && typeof hook[action] === "function") {
            val = hook[action](val, data)
        }
    })
    return val
}

bindingExecutors.duplex = function (val, elem, data) {
    duplexProxy[elem.nodeName.toLowerCase()](val, elem, data)
}

var duplexProxy = {}

duplexProxy.input = function (val, elem, data) {
    var $type = DOM.getAttribute(elem, "type")
    var elemValue = DOM.getAttribute(elem, "value")
    if (data.isChecked || $type === "radio") {
        var checked = data.isChecked ? !!val : val + "" === elemValue
        DOM.setBoolAttribute(elem, "checked", checked)
        DOM.setAttribute(elem, "oldValue", String(checked))
    } else if ($type === "checkbox") {
        var array = [].concat(val) //强制转换为数组
        var checked = array.indexOf(data.pipe(elemValue, data, "get")) > -1
        DOM.setBoolAttribute(elem, "checked", checked)
    } else {
        val = data.pipe(val, data, "set")
        DOM.setAttribute(elem, "value", String(val))
    }
}
duplexProxy.input = duplexProxy.textarea
duplexProxy.select = function (val, elem, data) {
    val = Array.isArray(val) ? val.map(String) : val + ""
    avalon(elem).val(val)
    DOM.setAttribute(elem, "oldValue", String(val))
}

})()
