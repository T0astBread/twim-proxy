const qs = require("querystring")
const logger = require("./logger")
const twauth = require("./twauth")
const consumer = require("./consumer-credentials.json")
const dummy = require("./dummy-data")

const USER_INFO_CACHE_TIME = 360000 //6 minutes
const userInfoCache = []

const DM_EVENTS_LIST_CACHE_TIME = 60000 //1 minute since the rate limit is 15rqs/15mins
const dmEventsListsCache = []

const extractOAuthTokenParams = apiResponse => {
    let tokens = qs.parse(apiResponse)
    return {
        token: tokens.oauth_token,
        secret: tokens.oauth_token_secret,
        userId: tokens.user_id ? tokens.user_id.toString() : undefined,
        screenName: tokens.screen_name
    }
}

const getRequestToken = causingEvent => new Promise((resolve, reject) => {
    // resolve(extractRequestToken(dummy.requestTokenResponse()))
    
    twauth.request("POST", "/oauth/request_token", null, {responseIsNotJSON: true}, causingEvent)
        .then(response => resolve(extractOAuthTokenParams(response)))
        .catch(err => reject(err))
})

exports.getRequestToken = getRequestToken

const getAccessToken = (verifier, token, secret, causingEvent) => new Promise((resolve, reject) => {
    twauth.request("POST", "/oauth/access_token", {token: token, secret: secret}, {authParams: {oauth_verifier: verifier}, responseIsNotJSON: true}, causingEvent)
        .then(response => {
            resolve(extractOAuthTokenParams(response))
        })
        .catch(err => reject(err))
})

exports.getAccessToken = getAccessToken

const loadOwnUserInfo = credentials => loadUserInfo(credentials.userId, credentials)

const loadUserInfo = (userId, credentials, causingEvent) => new Promise((resolve, reject) => {
    const funcEvent = logger.logEvent(causingEvent, {
        type: "function-call",
        functionName: "loadUserInfo",
        userId: userId,
        requestingUser: credentials.userId
    })

    if(!userId) reject({errorCode: "undefined-user-id", message: "userId was null or undefined"})
    const chachedInfo = userInfoCache[userId]
    if(chachedInfo && (Date.now() - chachedInfo.cacheTime < USER_INFO_CACHE_TIME)) {
        logger.logEvent(funcEvent, {
            type: "cache-serving",
            cache: "user-info",
            targetUser: userId,
            requestingUser: credentials.userId
        })
        resolve(userInfoCache[userId].data)
    }
    else twauth.request("GET", "/1.1/users/show.json", credentials, {params: {user_id: userId}}, funcEvent)
        .then(response => {
            userInfoCache[userId] = {data: response, cacheTime: Date.now()}
            logger.logEvent(funcEvent, {
                type: "caching",
                cache: "user-info",
                targetUser: userId,
                requestingUser: credentials.userId
            })
            resolve(response)
        })
        .catch(err => reject(err))
})

const getDirectMessageEventListApiResponse = (credentials, causingEvent) => new Promise((resolve, reject) => {
    const funcEvent = logger.logEvent(causingEvent, {
        type: "function-call",
        functionName: "getDirectMessageEventListApiResponse",
        requestingUser: credentials.userId
    })

    let cachedEvents = dmEventsListsCache[credentials.userId]
    if(cachedEvents && (Date.now() - cachedEvents.cacheTime < DM_EVENTS_LIST_CACHE_TIME)) {
        logger.logEvent(funcEvent, {
            type: "cache-serving",
            cache: "dm-events-lists",
            requestingUser: credentials.userId
        })
        resolve(cachedEvents.data)
    }
    else {
        twauth.request("GET", "/1.1/direct_messages/events/list.json", credentials, funcEvent)
        .then(response => {
            dmEventsListsCache[credentials.userId] = {data: response, cacheTime: Date.now()}
            logger.logEvent(funcEvent, {
                type: "caching",
                cache: "dm-events-lists",
                requestingUser: credentials.userId
            })
            resolve(response)
        })
        .catch(err => reject(err))
    }

    // resolve(dummy.directMessageEventsResponse())
})

const getConversations = (apiResponse, credentials) => new Promise((resolve, reject) => {
    const conversations = {}

    loadOwnUserInfo(credentials).then(() => {
        const processEvent = index => {
            if(index >= apiResponse.events.length) {
                resolve(conversations)
                return
            }
            let event = apiResponse.events[index]

            const handleError = err => {
                reject({message: err, faultyMessageEvent: event})
            }
            let recipientInfo, senderInfo, fromMe
            loadUserInfo(event.message_create.target.recipient_id, credentials)
            .then(recInfo => recipientInfo = recInfo, handleError)
            .then(() => loadUserInfo(event.message_create.sender_id, credentials))
            .then(sInfo => senderInfo = sInfo, handleError)
            .then(() => {
                fromMe = senderInfo.id_str === credentials.userId
                let conversationPartnerHandle = fromMe ? recipientInfo.screen_name : senderInfo.screen_name
                if(!conversations[conversationPartnerHandle]) conversations[conversationPartnerHandle] = []
                let message = {text: event.message_create.message_data.text, fromMe: fromMe}
                conversations[conversationPartnerHandle].push(message)
                processEvent(++index)
            })
        }
        processEvent(0)
    })
    .catch(err => reject(err))
})

exports.getConversations = (credentials, causingEvent) =>
    getDirectMessageEventListApiResponse(credentials, causingEvent)
        .then(response => getConversations(response, credentials))