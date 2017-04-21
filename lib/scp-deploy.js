let colors = require('colors')
let path = require('path')
let scpClient = require('scp2')
let Client = scpClient.Client
let rd = require('rd')

/**
 * src : local filepath
 * host: remote server host
 * port: remote server ssh port
 * path: remote server save path
 */
function scpDeploy(options){
    let stat = {
        filesize: 0,
        fileCount: 0
    }
    let uploaded = {
        count: 0,
        filesize: 0
    }
    let ProgressBar = require('progress')
    rd.eachSync(options.src, function (f, s) {
      if(!s.size) return
      stat[f] = s.size
      stat.filesize += s.size
      stat.fileCount += 1
    })
    let bar = new ProgressBar('[:bar] :current/:total', { 
        total: stat.fileCount,
        width: 50,
        incomplete: ' ',
        complete: '='
    })
    let returnData = {
        filesize: stat.filesize,
        fileCount: stat.fileCount
    }

    let promise = new Promise((resolve, reject)=>{
        let client = new Client()
        let src = options.src
        let startTime = new Date()
        returnData.startTime = startTime
        console.log(
            colors.gray(`[${startTime.toLocaleTimeString()}] `) +
            colors.green(`尝试连接服务器>`) +
            colors.green.underline(`ssh://${options.host}:${options.port}`)
        )
        client.on('connect', (e) => {
            let stime = (new Date).toLocaleTimeString()
            returnData.connectedTime = stime
            console.log(
                colors.gray(`[${stime}] `) +
                colors.green(`服务器连接成功>`) +
                colors.green.underline(`ssh://${options.host}:${options.port}`)
            )
        })
        client.on('write', (obj) => {
            let filepath = path.resolve(obj.source)
            let filesize = stat[filepath]
            uploaded.filesize += filesize
            uploaded.count += 1
            bar.tick(1 )
        })
        client.on('end', () => {
            let endTime = new Date()
            returnData.endTime = endTime
            console.log(`\ndeploy from ${colors.magenta.underline(path.resolve(options.src))} to ${colors.magenta.underline(options.host+':'+options.port+options.path)} Done!`)
            console.log(colors.gray(`[${endTime.toLocaleTimeString()}] `) + `耗时: ${colors.green(endTime-startTime)} ms` )
            resolve(returnData)
        })
        scpClient.scp(src, options, client, (err) => {
            if (err) reject(err)
        })
    })
    return promise
}

module.exports = scpDeploy