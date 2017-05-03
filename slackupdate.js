'use strict';

const aws = require('aws-sdk');
const https = require('https');
const qs = require('querystring');
const request = require('request');
const s3 = new aws.S3();
const db = new aws.DynamoDB();

const getSignedUrl = function (bucket, key) {
    console.log('Getting signed url for bucket');

    return new Promise((resolve, reject) => {
        const params = {
            Bucket: bucket,
            Key: key,
            Expires: 604800
        };
        const url = s3.getSignedUrl('getObject', params);
        resolve(url);
    });
};

const getShortUrl = function (url) {
    console.log('Getting short url');

    return new Promise((resolve, reject) => {
        const req = {
            uri: process.env.SHORTENER_API_URL + qs.stringify({
                key: process.env.SHORTENER_API_KEY
            }),
            method: 'POST',
            json: true,
            body: {
                longUrl: url
            }
        }

        request(req, (err, res, body) => {
            if (err && res.statusCode !== 200) {
                reject(err);
            } else {
                resolve(body.id);
            }
        });
    });
}

const writeToSlack = function (url, metadata, botAccessToken) {
    console.log('Posting image back to slack');
    return new Promise((resolve, reject) => {
        const slackParams = {
            token: botAccessToken,
            channel: metadata.channelid,
            text: url
        }

        const slackurl = process.env.POST_MESSAGE_URL + qs.stringify(slackParams);

        https.get(slackurl, (res) => {
            const statusCode = res.statusCode;
            resolve();
        })
    });
}

const getMetadata = function(bucket, key){
  console.log("getting metadata from event object")

  return new Promise((resolve, reject) => {
    const metadata = s3.getObject({
      Bucket: bucket,
      Key: key
    }, function (error, data) {
      if (error) {
        reject(error);
      } else {
        console.log("got object for Metadata", data)
        resolve(data.Metadata)
      }
    })
  });
};

const getBotAccessToken = function(metadata) {
  console.log("test tteam d ",metadata)
    return new Promise((resolve, reject) => {
        const params = {
            TableName: process.env.TEAMS_TABLE,
            Key: {
                "team_id": {
                    S: metadata.teamid
                }
            }
        };

        db.getItem(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.Item.bot.M.bot_access_token.S);
            }
        });
    });
};

module.exports.execute = (event, context, callback) => {
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    const metadata = getMetadata(bucket, key);
    const botAccessToken = metadata.then((team) => getBotAccessToken(team));

    const imageUrl = getSignedUrl(bucket, key)
        .then((url) => getShortUrl(url));

    Promise.all([imageUrl, metadata, botAccessToken])
        .then(([imageUrl,metadata,botAccessToken]) => writeToSlack(imageUrl,metadata,botAccessToken))
        .then(() => {
            console.log('Finished processing image');
            callback(null);
        })
        .catch((err) => {
            console.log(err);
            callback(err);
        });
};
