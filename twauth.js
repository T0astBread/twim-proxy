const crypto = require("crypto")
const https = require("https")
const qs = require("querystring")
const consumer = require("./consumer-credentials.json")

const createAuthHeader = (requestMethod, requestedUrl, credentials, params) => {
    let authParams = {
        oauth_consumer_key: consumer.key,
        oauth_token: credentials.token,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: Math.round(Date.now()/1000),
        oauth_nonce: Math.random().toString().substr(2),
        oauth_version: "1.0"
    }
    if(params) authParams = Object.assign(authParams, params)
    let paramsString = Object.keys(authParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(authParams[key])}`)
        .sort()
        .reduce((keyValPairA, keyValPairB) => `${keyValPairA}&${keyValPairB}`)
    // console.log(paramsString)
    let signatureBaseString = `${requestMethod.toUpperCase()}&${encodeURIComponent(requestedUrl)}&${encodeURIComponent(paramsString)}`
    // console.log(signatureBaseString)
    let consumerSecret = consumer.secret
    let accessTokenSecret = credentials.secret
    let signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`
    // console.log(signingKey)
    let signature = crypto.createHmac("SHA1", signingKey).update(signatureBaseString).digest("base64")
    // console.log(signature)
    authParams.oauth_signature = signature
    return `OAuth ${Object.keys(authParams)
        .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(authParams[key])}"`)
        .sort()
        .reduce((keyValPairA, keyValPairB) => `${keyValPairA}, ${keyValPairB}`)}`
}

exports.createAuthHeader = createAuthHeader

const createRequestOptions = (requestMethod, path, credentials, params) => {
    let uriPath = path
    if(params) {
        let paramsStr = qs.stringify(params)
        uriPath = `${path}?${paramsStr}`
    }
    let authHeader = createAuthHeader(requestMethod, `https://api.twitter.com${path}`, credentials, params)
    // console.log(authHeader)
    return {
        hostname: "api.twitter.com",
        path: uriPath,
        headers: {
            host: "api.twitter.com",
            authorization: authHeader
        }
    }
}

exports.createRequestOptions = createRequestOptions

exports.request = (method, path, credentials, params) => new Promise((resolve, reject) => {
    let paramsStr = params ? qs.stringify(params) : undefined
    let options = createRequestOptions(method, path, credentials, params)
    console.log(`Sending authorized and possibly rate limited request; path: ${path}${params ? `, params: ${paramsStr}` : ""}`)
    let request = https.request(options, res => {
        let responseBuffer = []
        res.on("data", chunk => responseBuffer.push(chunk))
        res.on("end", () => {
            let response = responseBuffer.join()
            try {
                let responseObj = JSON.parse(response)
                if(responseObj.errors) reject(responseObj)
                else resolve(responseObj)
            }
            catch(e) {
                console.log("Faulty response", response)
                reject(e)
            }
        })
    })
    request.on("error", err => reject(err))
    request.end()
})