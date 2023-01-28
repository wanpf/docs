## osm-edge 启用 HTTP追踪日志 ##
### 1. 配置参数 ###
在安装 osm-edge 时，需要配置如下参数：
```bash
--set=osm.deployJaeger="true"
--set=osm.tracing.enable="true"
--set=osm.tracing.address="jaeger.osm-system.svc.cluster.local:9411"
--set=osm.tracing.sampledFraction=1.0
```
### 2. 参数说明 ###
| 参数 | 说明 | 默认值 |
| :-----:| :----: | :----: |
| osm.deployJaeger | 是否部署 jaeger 服务 | false |
| osm.tracing.enable | 是否启用 jaeger tracing | false |
| osm.tracing.address | jaeger 服务地址 | 空 |
| osm.tracing.sampledFraction | 采样率 | 1.0 |
### 3. 采样说明 ###
