#! /usr/bin/env node

const startConversion = require("./convert.js");

let sourceFile = 'balances-testing.xls';
const arguments = process.argv.slice(2);
if (!arguments[0]) {
    console.warn('No transactions source file, defaulting to', sourceFile);
} else {
    sourceFile = arguments[0];
}
startConversion(sourceFile);