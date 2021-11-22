XLSX = require('xlsx');
var workbook = XLSX.readFile('balances.xls');

let cells = {
    A: 'date',
    B: 'account',
    C: 'type',
    D: 'status',
    E: 'amount',
    F: 'fee',
    G: 'rate',
    H: 'message',
    I: 'reserved',
    J: 'balance',
};

var first_sheet_name = workbook.SheetNames[0];
/* Get worksheet */
var worksheet = workbook.Sheets[first_sheet_name];

let transactionData = {};

let row=2; //skip first row, the header row
let lastRow = false; 
do {
    var rowData = {};
    for (let i of Object.keys(cells)) {
        let itemName = cells[i];
        if (worksheet[i+row]) {
            let cellRawValue = worksheet[i+row].v;
            switch (itemName) {
                case 'date':
                    /* It is assumed that Coinmotion's dates are in EET timezone */
                    /* FIXME the following only works correctly if your runtime environment
                    is in the same timezone (EET) */
                    rowData['origDate'] = cellRawValue;
                    let dateStr = cellRawValue.split(' ')[0];
                    let timeStr = cellRawValue.split(' ')[1];
                    
                    let day =  dateStr.split('.')[0];
                    let monthIndex = dateStr.split('.')[1]-1;
                    let year = dateStr.split('.')[2];
                    let hour = timeStr.split(':')[0];
                    let min = timeStr.split(':')[1];
                    let date = new Date(year, monthIndex, day, hour, min);
        
                    rowData[itemName] = date;
                    break;
                case 'amount':
                case 'fee':
                case 'balance':
                case 'reserved':
                    rowData[itemName] = parseFloat(worksheet[i+row].v.split(' ')[0]);
                    break;
                case 'rate': //rate is the euro worth of one unit of wallet's coin
                    rowData[itemName] = parseFloat(worksheet[i+row].v.split('(')[0].split(' ')[0]);
                    break;
                default:
                    rowData[itemName] = worksheet[i+row].v;
                    break;
            }
        }
        else {
            rowData[itemName] = null;
        }    
    }

    

    /* Stop processing when encountring row will no data */
    lastRow = true;
    for (let i of Object.keys(rowData)) {
        if (rowData[i]) {
            lastRow = false;
        }
    }
    if (lastRow) {
        break;
    }

    if (!transactionData[rowData.account]) {
        transactionData[rowData.account] = [];
    }

    transactionData[rowData.account].push(rowData);
    
    row++;
} while (!lastRow);

/* For each wallet, sort the transactions so that the newest transaction becomes 
the last transaction in the array */
for (let wallet of Object.keys(transactionData)) {
    let transactions = transactionData[wallet];
    transactions.sort((a, b) => {
        if (a.date.valueOf() > b.date.valueOf()) {
            // a's date is after b's date -> sort b before a
            return 1;
        }
        else if (a.date.valueOf() < b.date.valueOf()) {
            return -1;
        }
        else {
            return 0;
        }
    });
}


console.log(transactionData);

let calcBalanceBTC = 0;
for (t of transactionData.BTC) {
    calcBalanceBTC += t.amount;
}

console.log(`BTC: balance calculated from individual transactions ${calcBalanceBTC} versus last transaction's stated balance ${transactionData.BTC[transactionData.BTC.length-1].balance}`)

