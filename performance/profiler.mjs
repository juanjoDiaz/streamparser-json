import { readFileSync } from "fs";
import JSONParse2 from "../src/jsonparse.mjs";

const jsonStr = readFileSync("../samplejson/basic.json");
const jsonparse2 = new JSONParse2(
  { stringBufferSize: 64 * 1024, numberBufferSize: 64 * 1024 },
); // { stringBufferSize: 64 * 1024, numberBufferSize: 64 * 1024 }

// // console.log('Complex object example');
// // console.log('======================');
let runs = 100000;
while (runs-- > 0) {
  jsonparse2.write(jsonStr);
  // console.log(`RUN ${runs}.`)
}

// async function asyncLoop() {
//   // jsonparse2.write('[');
//   let runs = 1000;
//   while (runs-- > 0) {
//     jsonparse2.write(jsonStr);
//     // jsonparse2.write(',');
//     await new Promise(r => setTimeout(r))
//   }
//   // jsonparse2.write(jsonStr);
//   // jsonparse2.write(']');
// }

// Promise.resolve().then(asyncLoop).then(() => console.log('done'));
