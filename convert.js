XLSX = require('xlsx');
let util = require('util');
const axios = require('axios');

const getSellRateEur = async coin => {
    try {
        const response = await axios.get('https://api.coinmotion.com/v2/rates');
        if (response.data.success) {
            for (let c of Object.keys(response.data.payload)){
                if (c === coin.toLowerCase()+'Eur') {
                    return response.data.payload[c].sell;
                }
            }
        }
        else {
            return null;
        }
    } catch (error) {
      console.error('Axios', error);
      return null;
    }
};

const getTransactionsXLS = filename => {
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

    var workbook = XLSX.readFile(filename);
    
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
    return transactionData;    
}

/* For each wallet, sort the transactions so that the newest transaction becomes 
the last transaction in the array */
const sortTransactionDataFirstToLast = (transactionData) => {
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
};


const recalcBalance = (coin, transactionData) => {
    let calcBalance = 0;
    for (t of transactionData[coin]) {
        calcBalance += t.amount;
    }
    return calcBalance;
}


/* Find a zero point then after start advance towards newest transaction, until
a goal price is met */
const findZeroBalance= (coin, transactionData) => {
    // Find the most recent moment in time when balance was 0
    let startGainCalcIndex = 0;
    for (let i in transactionData[coin]) {
        let t = transactionData[coin][i];
        if (t.balance === 0) {
            console.log("Balance was zero at", t.date);
            startGainCalcIndex = i;
        }
    }
    startGainCalcIndex++; // Advance to next transaction after the tranascation which resulted in zero balance
    return startGainCalcIndex;
}

// Handle FIFO selling: 
const handleFifoSelling = (coin, transactionData, startGainCalcIndex, currentRate) => {
    // First, initialize each transaction with a new parameter fifoAmount, 
    // which holds the amount of this transaction which is sold
    for (let i = startGainCalcIndex; i < transactionData[coin].length;i++) {
        let t = transactionData[coin][i];
        if (t.amount > 0) {
            t.fifoAmount = t.amount;
        }
    }
    // Then, detect sell events, and for each sell event decrement fifoAmount
    // until amountSold is 'amortized' 
    for (let i = startGainCalcIndex; i < transactionData[coin].length;i++) {
        let t = transactionData[coin][i];
        if (t.amount < 0) {
            //This is a 'sell' event
            let amountSold = -t.amount;
            for (let j = startGainCalcIndex; j < transactionData[coin].length;j++) {
                let u = transactionData[coin][j];
                if (u.fifoAmount > 0) {
                    if (u.fifoAmount <= amountSold) {
                        amountSold -= u.fifoAmount;
                        u.fifoAmount = 0;
                    }
                    else {
                        u.fifoAmount-=amountSold;
                        amountSold = 0;
                        console.log('amountSold == 0 at transaction', u);
                        break;
                    }
                }
            }
        } 
    }

    // Now calculate the gain from each transaction, with current rate,
    // considering what is left 'fifo-wise'
    console.log('Here is what is left of each transaction considering FIFO')
    for (let i = startGainCalcIndex; i < transactionData[coin].length;i++) {
        let t = transactionData[coin][i];
        if (t.amount < 0) {
            continue;
        }
        let acquirementPrice = t.fifoAmount * t.rate + t.fee;
        let currentPrice = t.fifoAmount * currentRate;
        let gain = currentPrice - acquirementPrice;
        console.log(t.date, gain, '€');
    }
}

/* This function first seeks the latest point in time when wallet had zero-balance. Then 
it starts listing to Excel the transactions, in format required by Vero.fi calculator */
const formatForExternalSheet = (coin, transactionData, outputFileName) => {
    if (!outputFileName) {
        outputFileName = coin + '_transactions.xlsx';
    }
    let startGainCalcIndex = findZeroBalance(coin, transactionData);
    const transactions = transactionData[coin].slice(startGainCalcIndex);
    transactionArray = [];
    for (let t of transactions) {
        //if (t.status !== 'Valmis') continue;
        let buyRegexp = /osto/i;
        let sellRegexp = /myynti/i;
        if (t.type.match(buyRegexp)) {
            transactionArray.push([t.date, 'Osto', t.amount, t.rate, t.rate * t.amount, "Coinmotion"]);
        } else if (t.type.match(sellRegexp)) {
            transactionArray.push([t.date, 'Myynti', -t.amount, t.rate, t.rate * -t.amount, "Coinmotion"]);
        }
        
    }
    
    var workbook = XLSX.utils.book_new();
    var worksheet = XLSX.utils.aoa_to_sheet(transactionArray, { cellDates: true });
      XLSX.utils.book_append_sheet(workbook, worksheet, 'transactions for Vero.fi');
      XLSX.writeFile(workbook, outputFileName, {cellDates: true});
}

const startConversion = async (sourceFile) => {
    let transactionData = getTransactionsXLS(sourceFile);
    sortTransactionDataFirstToLast(transactionData);
    /*
    let calcBalance= recalcBalance(coin, transactionData);
    console.log(`${coin}: balance calculated from individual transactions ${calcBalance} versus last transaction's stated balance ${(transactionData[coin][transactionData[coin].length-1]).balance}`)
    let startGainCalcIndex = findZeroBalance(coin, transactionData);
    let currentRate = await getSellRateEur('BTC');
    handleFifoSelling(coin, transactionData, startGainCalcIndex, currentRate);
    */
    formatForExternalSheet('BTC', transactionData);
    formatForExternalSheet('ETH', transactionData);
};

module.exports = startConversion;