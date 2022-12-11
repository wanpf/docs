// version: '2022.12.11'
((
  http2tunnelActiveConnectionGauge = new stats.Gauge('http2tunnel_active_connection', ['source_address', 'destination_address', 'destination_port']),
  http2tunnelTotalConnectionCounter = new stats.Counter('http2tunnel_total_connection', ['source_address', 'destination_address', 'destination_port']),
  http2tunnelSendBytesTotalCounter = new stats.Counter('http2tunnel_send_bytes_total', ['source_address', 'destination_address', 'destination_port']),
  http2tunnelReceiveBytesTotalCounter = new stats.Counter('http2tunnel_receive_bytes_total', ['source_address', 'destination_address', 'destination_port']),
  serverLiveGauge = (new stats.Gauge('sidecar_server_live')).increase(),
  logLogging = new logging.JSONLogger('access-logging').toFile('/dev/stdout').log,
  prometheusTarget = '127.0.0.1:4040'
) => pipy({
  _id: null,
  _host: null,
  _port: null,
  _sourceIP: null,
  _protocol: null,
  _logDataStruct: null,
  _isTunnel: false,
  _target: undefined,
})

  .listen(8001)
  .onStart(
    () => (
      _host = null,
      _logDataStruct = {},
      _id = algo.uuid().substring(0, 18).replaceAll('-', ''),
      _logDataStruct['id'] = _id,
      _logDataStruct['start_time'] = (new Date()).toISOString(),
      _logDataStruct['source_address'] = _sourceIP = __inbound.remoteAddress,
      _logDataStruct['source_port'] = __inbound.remotePort,
      null
    )
  )
  .onEnd(
    () => (
      _host && http2tunnelActiveConnectionGauge.withLabels(_sourceIP, _host, _port).decrease(),
      _logDataStruct['end_time'] = (new Date()).toISOString(),
      logLogging(_logDataStruct)
    )
  )
  .demuxHTTP().to($ => $
    .handleMessageStart(
      msg => (msg.head.method === 'CONNECT') && (_isTunnel = true)
    )
    .branch(
      () => _isTunnel, ($ => $
        .acceptHTTPTunnel(
          msg => (
            _target = msg.head.path,
            _logDataStruct['destination_address'] = _host = _target.split(':')[0],
            _logDataStruct['destination_port'] = _port = _target.split(':')?.[1] || '',
            http2tunnelActiveConnectionGauge.withLabels(_sourceIP, _host, _port).increase(),
            http2tunnelTotalConnectionCounter.withLabels(_sourceIP, _host, _port).increase(),
            new Message({ status: 200 })
          )
        ).to($ => $
          .fork('logger-requests')
          .handleData(
            data => (
              http2tunnelSendBytesTotalCounter.withLabels(_sourceIP, _host, _port).increase(data.size)
            )
          )
          .connect(() => _target)
          .handleData(
            data => (
              http2tunnelReceiveBytesTotalCounter.withLabels(_sourceIP, _host, _port).increase(data.size)
            )
          )
        )
    ), ($ => $
      .replaceMessage(
        new Message({ status: 404 }, 'Not Found')
      )
    )
    )
  )

  //
  // Logging HTTP requests
  //
  .pipeline('logger-requests')
  .onStart(
    () => (
      _protocol = undefined,
      new Data
    )
  )
  .detectProtocol(
    protocolName => _protocol = protocolName
  )
  .branch(
    () => _protocol === 'HTTP', $ => $
      .demuxHTTP().to($ => $
        .handleMessageStart(
          msg => (
            ((request) => (
              request = {
                connection_id: _logDataStruct.id,
                request_time: (new Date()).toISOString(),
                source_address: _logDataStruct['source_address'],
                source_port: _logDataStruct['source_port'],
                host: msg.head.headers.host,
                path: msg.head.path,
                method: msg.head.method
              },
              logLogging(request)
            ))()
          )
        )
      ),
    () => _protocol === 'TLS', $ => $
      .handleTLSClientHello(
        (hello) => (
          _logDataStruct['serverNames'] = hello.serverNames,
          _logDataStruct['protocolNames'] = hello.protocolNames
        )
      ),
    () => _protocol === '', $ => $
  )
  .dummy()

  //
  // Prometheus collects metrics
  //
  .listen(15010)
  .demuxHTTP()
  .to($ => $
    .handleMessageStart(
      msg => (
        (msg.head.path === '/stats/prometheus' && (msg.head.path = '/metrics')) || (msg.head.path = '/stats' + msg.head.path)
      )
    )
    .muxHTTP(() => prometheusTarget)
    .to($ => $
      .connect(() => prometheusTarget)
    )
  )

)()