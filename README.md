# coinmotion-excel

This tool helps customers of the online cryptocurrency exchange Coinmotion in fulfilling their tax obligations towards the Finnish tax authorities (vero.fi).

This tool reads in the transaction history in Excel format from Coinmotion, and converts the transactions so that they can be pasted in to the  [tax calculator provided by Vero.fi.](https://www.vero.fi/tietoa-verohallinnosta/yhteystiedot-ja-asiointi/verohallinnon_laskuri/fifo-laskuri/)

## Important note regarding reliability of the results

This tool is a work in progress, and cannot be relied upon. Among other limitations, the tool does not currently take into account the fees charged by Coinmotion, and because of this it gives incorrect results!

## Usage

```
node main.js BTC balances.xls
```

Where 'BTC' is the symbol of the coin for which transactions are to be converted, and 'balances.xls' is the transaction history downloaded from Coinmotion.
