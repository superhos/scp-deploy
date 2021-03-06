# scp-deploy

An upload tool provided to developers using ssh

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
    password: 'ssh_password',
    src: [
      // foder1 not include subdirectory
      '/path/to/your/local/folder1/',

      // foder2 include subdirectory
      '/path/to/your/local/folder2/**',

      // filter *.css
      '/path/to/your/local/folder2/**.css'
    ],
    path: '/path/to/your/remote/foler/'
}).then((info)=>{
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

 > `/Users/zoborzhang/public/**.css` include subdirectory, all the css files

 > `/Users/zoborzhang/public/main.js` support single filename

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