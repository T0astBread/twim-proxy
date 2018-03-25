const express = require("express")
const cors = require("cors")
const host = require("./host.json")
const router = require("./router")

const app = express()
app.listen(host.port || 80, host.interface)

app.use(cors({methods: ["GET", "POST"], origin: host.origin}))
app.use(host.basePath || "/", router)