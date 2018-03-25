const sdh = require("shutdown-handler")
const fs = require("fs")
const path = require("path")
const sh = require("shelljs")
const config = require("./logger-config.json")

const executionStartDate = new Date()
const eventLog = []

const checkEvent = evt =>
    evt.type &&
    [
        "function-call",
        "incoming-request",
        "outgoing-request",
        "caching",
        "cache-serving",
        "other"
    ].includes(evt.type) &&
    ["debug", "verbose", "info", "success", "warning", "error"].includes(evt.level)

const logEvent = (parentEvt, evt) => {
    if(parentEvt) {
        evt.parentId = parentEvt.id
        if(!evt.action) evt.action = parentEvt.action
        if(!evt.type) evt.type = parentEvt.type
    }
    if(!evt.level) evt.level = "info"
    if(!checkEvent(evt)) return
    evt.id = eventLog.push(evt)
    console.log(evt)
    return evt
}

exports.logEvent = logEvent

const formatDateForFileName = date => date.toJSON().replace(/:/g, ".")

const saveLogs = cause => {
    let evt = logEvent(null, {
        type: "other",
        level: "info",
        action: "log-save",
        cause: cause,
        message: `Saving logs; cause: ${cause}`
    })
    if(config.savePath) {
        const logPath = __dirname.concat("/").concat(config.savePath
            .replace("%startdate", formatDateForFileName(executionStartDate))
            .replace("%logdate", formatDateForFileName(new Date()))
        )
        logEvent(evt, {
            level: "info",
            path: logPath,
            message: "Writing file to " + logPath
        })

        const logDir = path.dirname(logPath)
        if(!fs.exists(logDir)) sh.mkdir("-p", logDir)

        fs.writeFileSync(logPath, JSON.stringify({
            startDate: executionStartDate,
            log: eventLog
        }))
    }
    else {
        logEvent(evt, {
            level: "error",
            errorCode: "no-path-specifed",
            message: "No savePath for logs was specified"
        })
    }
}

const loggerStartEvent = logEvent(null, {
    type: "other",
    level: "info",
    action: "starting-logger",
    message: "Starting logger"
})
sdh.addListener("exit", shutdownEvt => {
    logEvent(null, {
        type: "other",
        action: "stopping-logger",
        message: "Shutting down logger"
    })
    if(config.saveTriggers.includes("exit")) saveLogs("exit")
})
if(config.saveTriggers.includes("timer")) {
    const saveInterval = config.saveInterval || 3600
    setInterval(() => saveLogs("timer"), saveInterval * 1000)
    logEvent(loggerStartEvent, {
        type: "other",
        action: "starting-log-save-timer",
        timerInterval: saveInterval
    })
}