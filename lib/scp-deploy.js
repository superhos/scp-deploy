let colors = require('colors')
let path = require('path')
let scpClient = require('scp2')
let Client = scpClient.Client
let rd = require('rd')
let ProgressBar = require('progress')
let fs = require('fs-extra')
let defaultConfig = {
  incomplete: '◄',//'○', //'◄',
  complete: '■',//'●' //'■'
}

class scpDeploy {
  constructor(options) {
    return this.index.bind(this)
  }

  index(options = {}) {
    this.options = Object.assign(defaultConfig, options)
    this.info = {}
    var errMsg
    if ((errMsg = this.checkConfig(options))!==true) {
      console.log(colors.red(errMsg))
      return
    }
    if (!this.checkSourcePath(options.src)) {
      console.log(colors.red('src path is empty:' + path.resolve(options.src)))
      return
    }
    this.copy2tmp().then(() => {
      this.fileData = this.statFiles('./tmp/')
      this.client = new Client()
      this.progress = this.createProgress()
      this.upload('./tmp/')
    })
    return this.returnPromise()
  }

  checkSourcePath(src){
    if (fs.statSync(src).isFile()) {
      return true
    }
    var files = fs.readdirSync(src)
    return files.length!=0
  }

  checkConfig(config){
    if (!config.username) {
      return 'config.username must be required'
    }
    if (!config.password) {
      return 'config.password must be required'
    }
    if (!config.port) {
      return 'config.port must be required'
    }
    if (!config.src) {
      return 'config.src must be required'
    }
    if (!config.path) {
      return 'config.path must be required'
    }
    if (!config.host) {
      return 'config.host must be required'
    }
    return true
  }

  copy2tmp() {
    if (typeof this.options.src === 'string') this.options.src = [this.options
      .src
    ]
    let promise = new Promise((resolve, reject) => {
      this.removePath('./tmp/').then(() => {
        this.options.src.map((item) => {
          this.copy({
            src: item
          })
        })
        resolve()
      })
    })
    return promise
  }

  copy(options) {
    if (!options.src) return
    if (typeof options.src !== 'string') return
    options.includeSub = false
    if (options.src.indexOf('**') > -1) {
      options.includeSub = true
    }
    if (/(\.\w+)$/.test(options.src)) {
      options.filetype = RegExp.$1
    }
    options.src = options.src.replace(/\*+\S*$/, '')
    let s = fs.lstatSync(options.src)
    // single file
    if (!fs.lstatSync(options.src).isDirectory()) {
      let filenameReg = /([^\\/]+)$/
      let filename = options.src.match(filenameReg)
      if (filename && filename.length) filename = filename[0]
      fs.copySync(options.src, './tmp/'+filename)
      return
    }

    // copy path
    fs.copySync(options.src, './tmp/', {
      filter: (src, dest) => {
        let s = fs.lstatSync(src)
          // filter subpath files
        if (!options.includeSub) {
          let regxSub = /(\\+)?tmp\\+(\w+)(\\+)+/
          if (regxSub.test(dest)) {
            return false
          }
        }
        // filter subpath folder
        if (!options.includeSub && s.isDirectory()) {
          let regxSub = /(\\+)?tmp\\+(\w+)(\\+)?/
          if (regxSub.test(dest)) {
            return false
          }
        }
        // filter filetype
        if (options.filetype && !s.isDirectory()) {
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

  createTemp() {
    let promise = new Promise((resolve, reject) => {
      this.removePath('./tmp/').then(() => {
          return this.mkdir('./tmp/')
        })
        .then(() => {
          resolve()
        })
    })
    return promise
  }

  removePath(src) {
    let promise = new Promise((resolve, reject) => {
      fs.remove(src, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    return promise
  }

  mkdir(src) {
    let promise = new Promise((resolve, reject) => {
      fs.mkdirp(src, (err) => {
        if (err) {
          reject(err)
        } else {
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
    scpClient.scp(src || this.options.src, config, this.client, (err) => {
      if (err && err.stack) {
        console.log(colors.red( err.stack ))
        this.onDeployError(err.stack)
      }
    })
    this.addEventsListener()
    console.log(
      colors.gray(`[${this.info.startTime.toLocaleTimeString()}] `) +
      colors.green(`Try to connect to server>`) +
      colors.green.underline(
        `ssh://${this.options.host}:${this.options.port}`)
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
      colors.green.underline(
        `ssh://${this.options.host}:${this.options.port}`)
    )
  }
  onSuccess(file) {
    this.progress.tick(1)
  }
  onEnd() {
    let s1 = colors.magenta.underline
    console.log(
      `\ndeploy from \n${s1(path.resolve(this.options.src.join('\n')))} \nto ${s1(this.options.host+':'+this.options.port+this.options.path)} Done!`
    )
    console.log(colors.gray(
        `[${this.info.uploadedTime.toLocaleTimeString()}] `) +
      `spend time: ${colors.green(this.info.uploadedTime-this.info.startTime)} ms`
    )
    this.onDeployEnd()
  }

  returnPromise() {
    let promise = new Promise((resolve, reject) => {
      this.onDeployEnd = () => {
        this.removePath('./tmp')
        resolve(this.info)
      }
      this.onDeployError = (errMsg) => {
        this.removePath('./tmp')
        reject(errMsg)
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
      incomplete: this.options.incomplete,
      complete: this.options.complete
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