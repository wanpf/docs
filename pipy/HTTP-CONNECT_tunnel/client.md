# HTTP tunnel client.js
```bash
pipy({
  _target: '69.64.93.57:80', // remote server
  _egress: '127.0.0.1:8001', // tunnel server
})

.listen(8000)
.connectHTTPTunnel(
  () => new Message({ 
    method: 'CONNECT',
    path: _target,
  })
).to(
  $=>$.muxHTTP(() => _target, { version: 2 }).to(
    $=>$.connect(() => _egress)
  )
)
```
# 测试命令
```bash
curl --connect-to 'www.showip.com:80:127.0.0.1:8000' http://www.showip.com/
```
