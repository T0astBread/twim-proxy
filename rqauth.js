const logger = require("./logger")

const extractAccessTokens = rq => {
    let credStr = rq.get("Identity")
    if(!credStr) return Error("Invalid Identity header")
    let tokens = credStr.split(" ")
    if(tokens.length < 2) return Error("Invalid Identity header")
    return {token: tokens[0], secret: tokens[1], userId: tokens[2]}
}

exports.extractAccessTokens = extractAccessTokens

const extractAccessTokensOrAnswer = (rq, rs, causingEvent) => {
    let accessTokens = extractAccessTokens(rq)
    if(accessTokens instanceof Error) {
        rs.statusCode = 500
        const error = {errorCode: "AuthenticationError", message: accessTokens.message}
        logger.logEvent(causingEvent, {
            level: "error",
            errorCode: error.errorCode,
            message: error.message
        })
        rs.send(error)
    }
    return accessTokens
}

exports.extractAccessTokensOrAnswer = extractAccessTokensOrAnswer