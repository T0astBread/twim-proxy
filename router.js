const router = require("express").Router()
const https = require("https")
const logger = require("./logger")
const rqauth = require("./rqauth")
const twauth = require("./twauth")
const twapi = require("./twapi")

const handleError = (err, rq, rs, causingEvent) => {
    let error = {errorCode: "Error"}
    if(typeof err === "string") error.message = err
    else if(typeof err === "object") error = Object.assign(error, err)
    logger.logEvent(causingEvent, {
        level: "error",
        errorCode: error.errorCode,
        message: error.message
    })
    rs.status(500)
    rs.send(error)
}

let requestTokenSecrets = []

router.get("/authenticate/requestToken", (rq, rs) => {
    let rqEvent = logger.logEvent(null, {
        type: "incoming-request",
        level: "info",
        method: "GET",
        path: "/authenticate/requestToken"
    })
    twapi.getRequestToken(rqEvent)
        .then(tokens => {
            requestTokenSecrets[tokens.token] = tokens.secret
            rs.send(tokens.token)
        })
        .catch(err => handleError(err, rq, rs, rqEvent))
})

router.get("/authenticate/accessToken", (rq, rs) => {
    let rqEvent = logger.logEvent(null, {
        type: "incoming-request",
        method: "GET",
        path: "/authenticate/accessToken"
    })

    if(!(rq.query.verifier && rq.query.token)) {
        rs.status(400)
        const error = {errorCode: "MissingParams", message: "One or more query parameters are missing"}
        logger.logEvent(rqEvent, {
            level: "error",
            errorCode: error.errorCode,
            message: error.message
        })
        rs.send(error)
        return
    }
    let secret = requestTokenSecrets[rq.query.token]
    logger.logEvent(rqEvent, {
        type: "other",
        action: "request-token-secret-store"
    })
    if(typeof secret !== "string") {
        rs.status(400)
        const error = {errorCode: "InvalidRequestToken", message: "The provided request token is not valid (anymore)"}
        logger.log(rqEvent, {
            level: "error",
            errorCode: error.errorCode,
            message: error.message
        })
        rs.send(error)
        return
    }
    twapi.getAccessToken(rq.query.verifier, rq.query.token, secret, rqEvent)
        .then(tokens => rs.send(tokens))
        .catch(err => handleError(err, rq, rs, rqEvent))
})

router.get("/list", (rq, rs) => {
    const rqEvent = logger.logEvent(null, {
        type: "incoming-request",
        method: "GET",
        path: "/list"
    })

    let creds = rqauth.extractAccessTokensOrAnswer(rq, rs, rqEvent)
    if(creds) twapi.getConversations(creds, rqEvent)
        .then(conversations => rs.send(conversations))
        .catch(err => handleError(err, rq, rs, rqEvent))
})

module.exports = router