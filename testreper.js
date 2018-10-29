var SSH = require('simple-ssh');
const fs = require('fs')
const path = require('path')
const key_rsa = fs.readFileSync(path.resolve(__dirname, './id_rsa'), 'utf8')


var data = "bal/bla /bla \n";
console.log(data.replace(/\n/g,'').replace(/ .*/g,''));
console.log(data.length);