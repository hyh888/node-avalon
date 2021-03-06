var parse5 = require('parse5')
var parser = new parse5.Parser();
var serializer = new parse5.Serializer();
//https://github.com/exolution/xCube/blob/master/XParser.js

var avalon = require('./avalon')
var vm = avalon.define({
    $id: "test",
    aaa: true,
    bbb: false
    })
    
function heredoc(fn) {
    return fn.toString().replace(/^[^\/]+\/\*!?\s?/, '').replace(/\*\/[^\/]+$/, '')
}
var text = heredoc(function(){
    /*
<!DOCTYPE html>
<html ms-controller="test">
    <head>
        <title>测试if绑定的后端渲染</title>
    </head>
    <body>
        <div ms-if="aaa"></div>
        <div ms-if="bbb"></div>
    </body>
</html>
     */
})
var dom = parser.parse(text)
console.log(dom.childNodes[1].childNodes[2].childNodes[0])
avalon.scan(dom, vm)


var str = serializer.serialize(dom);
console.log(str)
