'use strict';

const https = require('https');
const qs = require('querystring');

module.exports.endpoint = (event, context, callback) => {
    console.log('Received event', event);

    const request = {
        token: 'xoxb-174199654288-ZaIjVdX9G2xFpCZC0mGB5C9G'
    }

    const url = 'https://slack.com/api/users.list?' + qs.stringify(request);

    https.get(url, (res) => {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
            try {
                console.log(JSON.parse(rawData));
            } catch (e) {
                console.log(e.message);
            }
        });
    });
};
