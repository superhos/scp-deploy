let colors = require('colors')
let path = require('path')
let scpClient = require('scp2')
let Client = scpClient.Client
let rd = require('rd')
let ProgressBar = require('progress')
let fs = require('fs-extra')

class scpDeploy {
    constructor(options) {
        return this.index.bind(this)
    }

    index(options={}) {
        this.options = options
        this.info = {}
        this.copy2tmp().then(()=>{
            this.fileData = this.statFiles('./tmp')
            this.client = new Client()
            this.progress = this.createProgress()
            this.upload('./tmp')
        })
        return this.returnPromise()
    }

    copy2tmp(){
        if (typeof this.options.src==='string') this.options.src = [this.options.src]
        let promise = new Promise((resolve, reject)=>{
            this.removePath('./tmp').then(()=>{
                this.options.src.map((item)=>{
                    this.copy({src: item})
                })
                resolve()
            })
        })
    return promise
    }

    copy(options){
        if (!options.src) return
        if (typeof options.src!=='string') return
        options.includeSub = false
        if (options.src.indexOf('**')>-1) {
            options.includeSub = true
        }
        if (/(\.\w+)$/.test(options.src)) {
            options.filetype = RegExp.$1
        }
        options.src = options.src.replace(/\*+\S*$/,'')
        fs.copySync(options.src, './tmp', {
            filter: (src, dest)=>{
                let s = fs.lstatSync(src)
                // filter subpath files
                if (!options.includeSub){
                    let regxSub = /(\\+)?tmp\\+(\w+)(\\+)+/
                    if (regxSub.test(dest)) {
                        return false
                    }
                }
                // filter subpath folder
                if (!options.includeSub && s.isDirectory()){
                    let regxSub = /(\\+)?tmp\\+(\w+)(\\+)?/
                    if (regxSub.test(dest)) {
                        return false
                    }
                }
                // filter filetype
                if (options.filetype && !s.isDirectory()){
                    let regxFiletype = `${options.filetype}$`
                    regxFiletype = new RegExp(regxFiletype)
                    if (!regxFiletype.test(src)) {
                        return false
                    }
                }
                return true
            }
        })
    }

    createTemp(){
        let promise = new Promise((resolve, reject)=>{
            this.removePath('./tmp').then(()=>{
                return this.mkdir('./tmp')
            })
            .then(()=>{
                resolve()
            })
        })
        return promise
    }

    removePath(src){
        let promise = new Promise((resolve, reject)=>{
            fs.remove(src, (err)=>{
                if (err){
                    reject(err)
                }else{
                    resolve()
                }    
            })
        })
        return promise
    }

    mkdir(src){
        let promise = new Promise((resolve, reject)=>{
            fs.mkdirp(src, (err)=>{
                if (err){
                    reject(err)
                }else{
                    resolve()
                }    
            })
        })
        return promise
    }

    upload(src) {
        this.info.startTime = new Date()
        let config = {}
        'host|port|username|password|path'.split('|').map((item) => {
            config[item] = this.options[item]
        })
        scpClient.scp(src || this.options.src, config, this.client, (err) => {})
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
        console.log(`\ndeploy from \n${s1(path.resolve(this.options.src.join('\n')))} \nto ${s1(this.options.host+':'+this.options.port+this.options.path)} Done!`)
        console.log(colors.gray(`[${this.info.uploadedTime.toLocaleTimeString()}] `) + `spend time: ${colors.green(this.info.uploadedTime-this.info.startTime)} ms`)
        this.onDeployEnd()
        this.removePath('./tmp')
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
            width: this.options.processWidth || 30,
            incomplete: '-',
            complete: '+'
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
            let stat = fs.lstatSync(f)
            if (stat.isDirectory()) return
            data[f] = s.size
            data.totalFilesize += s.size
            data.filesCount += 1
        })
        this.info.totalFilesize = data.totalFilesize
        this.info.filesCount = data.filesCount
        return data
    }
}
module.exports = new scpDeploy