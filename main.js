#! /usr/bin/env node

const startConversion = require("./convert.js");

let sourceFile = 'balances-testing.xls';
let coin = 'BTC';
const arguments = process.argv.slice(2);
if (arguments.length != 2) {
    console.warn(`Not exactly two parameters, using defaults: ${coin} ${sourceFile}`);
} else {
    coin = arguments[0];
    sourceFile = arguments[1];
}
startConversion(coin, sourceFile);