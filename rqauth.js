const extractAccessTokens = rq => {
    let credStr = rq.get("Identity")
    if(!credStr) return Error("Invalid Identity header")
    let tokens = credStr.split(" ")
    if(tokens.length !== 2) return Error("Invalid Identity header")
    return {token: tokens[0], secret: tokens[1]}
}

exports.extractAccessTokens = extractAccessTokens

const extractAccessTokensOrAnswer = (rq, rs) => {
    let accessTokens = extractAccessTokens(rq)
    if(accessTokens instanceof Error) {
        rs.statusCode = 500
        rs.send({errorCode: "AuthenticationError", message: accessTokens.message})
    }
    return accessTokens
}

exports.extractAccessTokensOrAnswer = extractAccessTokensOrAnswer