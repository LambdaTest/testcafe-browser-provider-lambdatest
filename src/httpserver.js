// const http = require('http');
// var portfinder = require('portfinder');

// portfinder.getPort({
//     port: 10000,    // minimum port
//     stopPort: 99999 // maximum port
// }, function (err, port) {
//     // Create a local server to receive data from
//     const server = http.createServer((req, res) => {
//             res.writeHead(200, { 'Content-Type': 'application/json' });
//             res.end(JSON.stringify({
//             data: 'Hello World!'
//         }));
//         req.on('data', chunk => {
//             console.log(`${chunk}`)
//         })
//         req.on('end', () => {
//             //end of data
//         })
//     });
//     console.log(port);
//     server.listen(port);    
// });

