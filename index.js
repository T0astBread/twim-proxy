const express = require("express")
const cors = require("cors")
const https = require("https")
const host = require("./host.json")
const rqauth = require("./rqauth")
const twauth = require("./twauth")
const twapi = require("./twapi")

// console.log(twauth.createAuthHeader("GET", "https://api.twitter.com/1.1/direct_messages/events/list.json"))
// twauth.createAuthHeader("GET", "https://api.twitter.com/1.1/direct_messages/events/list.json")

const app = express()
app.listen(80)

app.use(cors({methods: ["GET", "POST"], origin: host.origin}))

const handleError = (err, rq, rs) => {
    console.log(err)
    rs.status(500)
    rs.send({errorCode: "Error", message: err.toString()})
}

let requestTokenSecrets = []

app.route("/authenticate/requestToken")
    .get((rq, rs) => {
        twapi.getRequestToken()
            .then(tokens => {
                requestTokenSecrets[tokens.token] = tokens.secret
                rs.send(tokens.token)
            })
            .catch(err => handleError(err, rq, rs))
    })

app.route("/authenticate/accessToken")
    .get((rq, rs) => {
        if(!(rq.query.verifier && rq.query.token)) {
            rs.status(400)
            rs.send({errorCode: "MissingParams", message: "One or more query parameters are missing"})
            return
        }
        let secret = requestTokenSecrets[rq.query.token]
        console.log("token: " + rq.query.token, "\nsecret: " + secret)
        if(typeof secret !== "string") {
            rs.status(400)
            rs.send({errorCode: "InvalidRequestToken", message: "The provided request token is not valid (anymore)"})
            return
        }
        twapi.getAccessToken(rq.query.verifier, rq.query.token, secret)
            .then(tokens => rs.send(tokens))
            .catch(err => handleError(err, rq, rs))
    })

app.route("/list")
    .get((rq, rs) => {
        rs.setHeader("Content-Type", "application/json")
        let creds = rqauth.extractAccessTokensOrAnswer(rq, rs)
        if(creds) twapi.getConversations(creds)
            .then(conversations => rs.send(conversations))
            .catch(err => {
                console.log(err)
                rs.sendStatus(500)
            })
    })