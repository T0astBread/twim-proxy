const express = require("express")
const cors = require("cors")
const https = require("https")
const rqauth = require("./rqauth")
const twauth = require("./twauth")
const twapi = require("./twapi")

// console.log(twauth.createAuthHeader("GET", "https://api.twitter.com/1.1/direct_messages/events/list.json"))
// twauth.createAuthHeader("GET", "https://api.twitter.com/1.1/direct_messages/events/list.json")

const app = express()
app.listen(80)

app.use(cors({origin: "*"}))

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