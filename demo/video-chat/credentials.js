const fs = require('fs');
module.exports = {
    // key: null,
    // cert: null
    key: fs.readFileSync('key.pem', 'utf8'),
    cert: fs.readFileSync('cert.pem', 'utf8')
};