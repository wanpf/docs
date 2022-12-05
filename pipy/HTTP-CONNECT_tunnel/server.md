# HTTP tunnel server.js
```bash
pipy({
  _isTunnel: false,
  _target: undefined,
})

.listen(8001)
.demuxHTTP().to(
  $=>$.handleMessageStart(
    msg => (msg.head.method === 'CONNECT') && (_isTunnel = true)
  )
  .branch(
    () => _isTunnel, (
      $=>$.acceptHTTPTunnel( 
        msg => (
          _target = msg.head.path,
          new Message({ status: 200 })
        )
      ).to(
        $=>$.connect(() => _target)
      )
    ), (
      $=>$.replaceMessage(
        new Message({ status: 404 }, 'Not Found')
      )
    )
  )
)
```
