const qs = require("querystring")
const twauth = require("./twauth")
const consumer = require("./consumer-credentials.json")
const dummy = require("./dummy-data")

const extractOAuthTokenParams = apiResponse => {
    let tokens = qs.parse(apiResponse)
    return {
        token: tokens.oauth_token,
        secret: tokens.oauth_token_secret,
        userId: tokens.user_id,
        screenName: tokens.screen_name
    }
}

const getRequestToken = () => new Promise((resolve, reject) => {
    // resolve(extractRequestToken(dummy.requestTokenResponse()))
    
    twauth.request("POST", "/oauth/request_token", null, {authParams: {oauth_callback: "http://local.t0ast.cc:3000"}, responseIsNotJSON: true})
        .then(response => resolve(extractOAuthTokenParams(response)))
        .catch(err => reject(err))
})

exports.getRequestToken = getRequestToken

const getAccessToken = (verifier, token, secret) => new Promise((resolve, reject) => {
    twauth.request("POST", "/oauth/access_token", {token: token, secret: secret}, {authParams: {oauth_verifier: verifier}, responseIsNotJSON: true})
        .then(response => {
            resolve(extractOAuthTokenParams(response))
        })
        .catch(err => reject(err))
})

exports.getAccessToken = getAccessToken

let ownUserInfo = undefined

const loadOwnUserInfo = credentials => new Promise((resolve, reject) => {
    if(ownUserInfo) {
        resolve(ownUserInfo)
    }
    else twauth.request("GET", "/1.1/account/verify_credentials.json", credentials)
        .then(info => resolve(ownUserInfo = info))
        .then(() => console.log("Successfully loaded own user info"))
        .catch(err => reject(err))
})

const userInfoCache = []

const loadUserInfo = (userId, credentials) => new Promise((resolve, reject) => {
    loadOwnUserInfo(credentials)
        .then(ownInfo => {
            if(ownInfo.id_str === userId) resolve(ownInfo)
            else if(userInfoCache[userId]) resolve(userInfoCache[userId])
            else twauth.request("GET", "/1.1/users/show.json", credentials, {params: {user_id: userId}})
                .then(response => {
                    userInfoCache[userId] = response
                    console.log("Chached user: " + userId)
                    resolve(response)
                })
                .catch(err => reject(err))
        })
})

const getDirectMessageEventListApiResponse = credentials => new Promise((resolve, reject) => {
        resolve(dummy.directMessageEventsResponse())
        
        // twauth.request("GET", "/1.1/direct_messages/events/list.json", credentials)
        // .then(response => resolve(response))
        // .catch(err => reject(err))
})

const getConversations = (apiResponse, credentials) => new Promise((resolve, reject) => {
    const conversations = {}

    loadOwnUserInfo(credentials).then(() => {

        const processEvent = index => {
            if(index >= apiResponse.events.length) {
                console.log("Done processing message events, resolving")
                resolve(conversations)
                return
            }
            console.log(`Processing message event #${index}`)
            let event = apiResponse.events[index]

            let recipientInfo, senderInfo, fromMe
            console.log(event.message_create.target.recipient_id)
            loadUserInfo(event.message_create.target.recipient_id, credentials)
            .then(recInfo => recipientInfo = recInfo)
            .catch(err => reject(err))
            .then(() => loadUserInfo(event.message_create.sender_id, credentials))
            .then(sInfo => senderInfo = sInfo)
            .catch(err => reject(err))
            .then(() => {
                fromMe = senderInfo.id_str === ownUserInfo.id_str
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

exports.getConversations = credentials => getDirectMessageEventListApiResponse(credentials).then(response => getConversations(response, credentials))