# scp-deploy

## Install
```
$ npm install scp-deploy --save-dev
```

## API
```js
let scpDeploy = require('scp-deploy')
scpDeploy({
    host: 'your remote host',
    port: 22, // ssh port,
    username: 'ssh_user',
    passowrd: 'ssh_password',
    src: '/path/to/your/local/folder/',
    path: '/path/to/your/remote/foler/'
}).then((info)=>{
    console.log('done!')
    console.log(info)
}).catch((err)=>{
    console.log(err)
})

# info fomat
{
  totalFilesize: 1712372,
  filesCount: 45,
  startTime: 2017-04-22T14:31:35.969Z,
  connetedTime: 2017-04-22T14:31:36.073Z,
  uploadedTime: 2017-04-22T14:31:39.206Z
}
```