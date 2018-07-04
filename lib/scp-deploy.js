const colors = require('colors')
const path = require('path')
const scpClient = require('scp2')
const Client = scpClient.Client
const ProgressBar = require('progress')
const fs = require('fs-extra')
const _ = require('lodash')
const utils = require('./utils')
let defaultConfig = {
  incomplete: ' ',
  complete: '=',
  tempPath: './tmp'
}
var defaultOption = {
  showUploadDetail: true,
  successChar: '√',
  port: 22
}
const REG_ALL_FOLDER = /^\*{2}\/[\w\._-]+\/\*{2}$/

process.on('uncaughtException', (error)=>{
  console.log( colors.red(error.message) )
  console.log( colors.red(error.stack) )
})

class scpDeploy {
  constructor(options) {
    this.options = options
    return this.main.call(this)
  }

  async main(){
    if(!this.options) {
      return
    }
    this.options = Object.assign({}, defaultOption ,this.options)
    this.info = {}
    this.config = this.parseUserConfig(this.options)
    if(this.options.debug){
      console.log(this.config)
      if ( this.options.debug.onlyShowConfig ){
        return;
      }
    }
    if (this.config.enableFilter){
      for(var i in this.config.src){
        if (i=='length') continue
        await this.execCopy( this.config.src[i], defaultConfig.tempPath )
      }
      this.uploadSource = defaultConfig.tempPath
    }else{
      var source
      for(var i in this.config.src){
        if (i=='length') continue
        source = i
      }
      this.uploadSource = source
    }
    if ( this.uploadSource ){
      this.fileData = utils.statFiles(this.uploadSource)
      this.index = 0
      this.client = new Client()
      this.progress = this.createProgress()
      this.upload( this.uploadSource )
      return this.returnPromise()
    }
  }

  async execCopy(opts, dest){
    var isExist = await utils.isDirectoryExist(dest)
    if (!isExist) {
      await fs.mkdirSync(dest)
    }
    fs.copySync(opts.src, utils.pathResolve(dest), {
      filter: (src, dest)=>{
        var isExclude
        isExclude = this.isExclude(src)
        if (!isExclude &&
          this.options.onlyLastmodify &&
          !utils.isDirectory(src)
        ){
          try{
            var st = fs.statSync(src)
          }catch(err){
            console.log(err)
          }
          if(+st.mtime < +new Date(this.options.onlyLastmodify)){
            isExclude = true
          }else{
            // console.log(src, st.mtime)
          }
        }
        return !isExclude
      }
    })
  }

  isExclude(src){
    var isExclude = false
    this.config.exclude.map(item=>{
      if (isExclude) return
      var filetype = utils.getFiletype(src)

      // exclude folder
      if ( REG_ALL_FOLDER.test(item.src) ){
        var filter = item.src.replace(/\*/g,'').replace(/\/$/,'')
        if ( src.indexOf(filter)>-1 ){
          isExclude = true
        }
      }
      // exclude filetype
      else if (item.src == '/'){
        if (item.filetype){
          if (filetype == item.filetype){
            isExclude = true
          }
        }
      }
      // substring of filter
      else if(src.indexOf(item.src)>-1){

        if ( utils.isDirectory(src) ){
          src += '/'
        }
        if ( utils.isDirectory(item.src) ){
          item.src += '/'
        }
        // distinct between dir and file
        // /.git/ and /.gitignore
        if ( src.indexOf(item.src)==-1) {
          return
        }
        if (item.filetype){
          if (filetype == item.filetype){
            isExclude = true
          }
        }else{
          isExclude = true
        }
      }
    })
    return isExclude
  }

  checkSource(src){
    if(!src){
      utils.error({type: 'config.src', param: JSON.stringify(src)})
    }
    if(_.isArray(src) && !src.length){
      utils.error({type: 'config.src', param: JSON.stringify(src)})
    }
  }

  checkParams(opts){
    'host|path|username'.split('|').map(item=>{
      if (!opts[item]){
        utils.error({type: `config.${item}`, param: JSON.stringify(opts[item])})
      }
    })

    //Check password or privatekey
    if (!opts['password'] && !opts['privateKey']){
      utils.error({type: `password or privateKey`, param: undefined});
    }
  }

  parseUserConfig(opts){
    var config = {
      enableFilter: false,
      src: {
        length: 0
      },
      exclude: []
    }
    this.config = config
    if(_.isString(opts.src)) opts.src = [opts.src]
    this.checkSource(opts.src)
    this.checkParams(opts)
    // src each
    opts.src.forEach(item=>{
      if (!item) {
        utils.error({type: 'param', param: JSON.stringify(item)})
      }
      var type = 'include'
      var src
      // exclude
      if (/^-/.test(item)) {
        item = item.replace(/^-/,'')
        src = utils.pathResolve(item)
        type = 'exclude'
        config.enableFilter = true
        // all the filetype exclude
        // -*.js or -*.scss
        if (/^\*+\.\w+$/.test(item)) {
          src = '/'
        }
        else if ( REG_ALL_FOLDER.test(item) ) {
          src = item
        }
        var ex = Object.assign({},parse(item),{src: src})
        config.exclude.push(ex)
      }else{
        src = utils.pathResolve(item)
        config.src.length ++
        config.src[src] = Object.assign({},parse(item),{src: src})
        if(config.src[src].filetype) config.enableFilter = true
      }

    })

    function parse(src){
      var conf = {}
      if(src.indexOf('**')>-1) {
        conf.includeSubdirectories = true
        config.enableFilter = true
      }
      if(/\.(\w+)$/.test(src)) {
        conf.filetype = RegExp.$1
      }
      return conf
    }
    return config
  }

  upload(src) {
    this.info.startTime = new Date()
    let config = {}
    'host|port|username|password|privateKey|passphrase|path'.split('|').map((item) => {
      config[item] = this.options[item]
    })
    this.addEventsListener()
    scpClient.scp(src, config, this.client, err=>{})
    console.log(
      colors.gray(`[${this.info.startTime.toLocaleTimeString()}] `) +
      colors.green(`Try to connect to server> `) +
      colors.green.underline(
        `ssh://${this.options.host}:${this.options.port}`)
    )
    this.connectTimer = setTimeout(() => {
      console.log(
        colors.gray(`[${new Date().toLocaleTimeString()}] `) +
        colors.red(`connect timeout`)
      )
      this.exit()
    }, 6000)
  }

  exit(){
    this.client.close()
    process.exit()
  }

  onConnect() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }
    console.log(
      colors.gray(`[${this.info.startTime.toLocaleTimeString()}] `) +
      colors.green(`Success connect to server> `) +
      colors.green.underline(
        `ssh://${this.options.host}:${this.options.port}`)
    )
    this.info.connetedTime = +new Date()
    console.log([
      (this.options.successChar).green,
      ' connect to server spend: '.cyan,
      `${(this.info.connetedTime - this.info.startConnectTime)} ms`.red.bold
    ].join(''))
  }

  onProgress(file) {
    if (this.options.showUploadDetail){
      console.log([
        (' >>> ').green,
        `${++this.index}/${this.fileData.filesCount}`.cyan.bold,
        (file).magenta
      ].join(' '))
    }else{
      this.progress.tick(1)
    }
  }

  onError(err){
    console.log(`${err}`.red.underline.italic)
    this.exit()
  }

  onSuccess() {
    var source = []
    for (var i in this.config.src ){
      if (i=='length') continue
      source.push(` ◦ ${i}`.cyan.italic)
    }
    var filesize = this.fileData.totalFilesize/1024
    var spend = (this.info.uploadedTime-this.info.startTime)/1000
    console.log(`\n---upload success---`.cyan.bold)
    console.log(`from local path >>>`.cyan.italic)
    console.log(source.join('\n'))
    console.log(`to server path >>>`.cyan)
    console.log((` ◦ ${this.options.username}@${this.options.host}:${this.options.path} \n`).cyan)
    console.log(`---upload stat---`.cyan.bold)
    console.log(` ◦ file count: ${this.fileData.filesCount}`.cyan)
    console.log(` ◦ file size: ${filesize} kb`.cyan)
    console.log(` ◦ time spend: ${spend} s`.cyan)
    console.log(` ◦ upload speed: ${parseInt(filesize/spend)} kb/s`.cyan)
    this.onDeployEnd()
  }

  returnPromise() {
    let clear = ()=>{
      if (this.config.enableFilter){
        utils.removePath(defaultConfig.tempPath)
      }
    }
    let promise = new Promise((resolve, reject) => {
      this.onDeployEnd = () => {
        clear()
        resolve(this.info)
      }
      this.onDeployError = (errMsg) => {
        clear()
        reject(errMsg)
      }
    })
    return promise
  }

  addEventsListener() {
    this.info.startConnectTime = +new Date
    this.client.on('connect', () => {})

    this.client.on('ready', (a,b)=>{
      this.onConnect()
    })

    this.client.on('transfer',(buffer, uploaded, total)=>{
    })

    this.client.on('write', obj => {
      this.onProgress(obj.source)
    })

    this.client.on('close', obj => {})

    this.client.on('error', err => {
      this.onError(err)
    })

    this.client.on('end', () => {
      this.info.uploadedTime = new Date
      this.onSuccess()
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

}
module.exports = function(opts){
  return new scpDeploy(opts)
}
