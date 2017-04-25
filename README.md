# scp-deploy

*The upload tool provided to the developer by ssh*
----

## Install
```
$ npm install scp-deploy --save-dev
```

## API
```js
let deploy = require('scp-deploy')
deploy({
    host: 'your remote host',
    port: 22, // ssh port,
    username: 'ssh_user',
    passowrd: 'ssh_password',
    src: [
      // foder1 not include subdirectory
      '/path/to/your/local/folder1/',
      // foder2 include subdirectory
      '/path/to/your/local/folder2/**',
      // filter *.js
      '/path/to/your/local/folder2/**.js'
    ],
    path: '/path/to/your/remote/foler/'
}).then((info)=>{
    console.log('done!')
    console.log(info)
}).catch((err)=>{
    console.log(err)
})
```

## Options
* `host` You want to upload the file to which server
* `port` the server ssh port
* `username` the server ssh login user
* `password` the server ssh login user's password
* `path` the path you want to save the files
* `src` local path can be an array or a string
 > `/Users/zoborzhang/public/` the public folder's files not include subdirectory

 > `/Users/zoborzhang/public/**` the public fodler's files include subdirectory

 > `/Users/zoborzhang/public/*.js` not include subdirectory, all the javascript files

 > `/Users/zoborzhang/public/**.js` include subdirectory, all the javascript files

## callback info format
```js
{
  totalFilesize: {Number},
  filesCount: {Number},
  startTime: {Object Date},
  connetedTime: {Object Date},
  uploadedTime: {Object Date}
}
```
