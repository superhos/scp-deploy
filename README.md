# scp-deploy

## Install
```
npm install scp-deploy --save-dev
```

## API
```
let scpDeploy = require('scp-deploy')
scpDeploy({
    host: 'your remote host',
    port: 22, // ssh port
    src: '/path/to/your/local/folder/',
    path: '/path/to/your/remote/foler/'
}).then((info)=>{
    console.log('upload done~')
    console.log(info)
}).catch((err)=>{
    console.log(err)
})
```