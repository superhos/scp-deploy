let colors = require('colors')
let path = require('path')
let scpClient = require('scp2')
let Client = scpClient.Client
let rd = require('rd')
let ProgressBar = require('progress')

class scpDeploy {
    constructor(options) {
        return this.index.bind(this)
    }

    index(options) {
        this.options = options
        this.info = {}
        this.fileData = this.statFiles(this.options.src)
        this.info.totalFilesize = this.fileData.totalFilesize
        this.info.filesCount = this.fileData.filesCount
        this.client = new Client()
        this.progress = this.createProgress()
        this.upload()
        return this.returnPromise()
    }

    upload() {
        this.info.startTime = new Date()
        let config = {}
        'host|port|username|password|path'.split('|').map((item) => {
            config[item] = this.options[item]
        })
        scpClient.scp(this.options.src, config, this.client, (err) => {})
        this.addEventsListener()
        console.log(
            colors.gray(`[${this.info.startTime.toLocaleTimeString()}] `) +
            colors.green(`Try to connect to server>`) +
            colors.green.underline(`ssh://${this.options.host}:${this.options.port}`)
        )
        this.connectTimer = setTimeout(() => {
            console.log(
                colors.gray(`[${new Date().toLocaleTimeString()}] `) +
                colors.red(`connect timeout`)
            )
            process.exit()
        }, 6000)
    }

    onConnect() {
        if (this.connectTimer) {
            clearTimeout(this.connectTimer)
            this.connectTimer = null
        }
        console.log(
            colors.gray(`[${this.info.startTime.toLocaleTimeString()}] `) +
            colors.green(`Success connect  to server>`) +
            colors.green.underline(`ssh://${this.options.host}:${this.options.port}`)
        )
    }
    onSuccess(file) {
        this.progress.tick(1)
    }
    onEnd() {
        let s1 = colors.magenta.underline
        console.log(`\ndeploy from ${s1(path.resolve(this.options.src))} to ${s1(this.options.host+':'+this.options.port+this.options.path)} Done!`)
        console.log(colors.gray(`[${this.info.uploadedTime.toLocaleTimeString()}] `) + `spend time: ${colors.green(this.info.uploadedTime-this.info.startTime)} ms`)
        this.onDeployEnd()
    }

    returnPromise(){
        let promise = new Promise((resolve, reject)=>{
            this.onDeployEnd = ()=>{
                resolve(this.info)
            }
        })
        return promise
    }

    addEventsListener() {
        this.client.on('connect', (e) => {
            this.info.connetedTime = new Date()
            this.onConnect()
        })

        this.client.on('write', (obj) => {
            this.onSuccess(obj.source)
        })

        this.client.on('end', () => {
            this.info.uploadedTime = new Date
            this.onEnd()
        })
    }

    createProgress() {
        let progress = new ProgressBar('[:bar] :current/:total (:percent)', {
            total: this.fileData.filesCount,
            width: this.options.processWidth || 50,
            incomplete: ' ',
            complete: '='
        })
        return progress
    }

    statFiles(path) {
        let data = {
            filesCount: 0,
            totalFilesize: 0
        }
        rd.eachSync(path, function(f, s) {
            if (!s.size) return
            data[f] = s.size
            data.totalFilesize += s.size
            data.filesCount += 1
        })
        return data
    }
}
module.exports = new scpDeploy