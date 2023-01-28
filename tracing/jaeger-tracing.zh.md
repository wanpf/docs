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
**追踪日志的 trace id 和 span id 均由8个字节（64 bits）的数值表示**，如下：    
"traceId":"1e2d1e9531fe404c","id":"d6887727c1e94889"    
**采用和 OpenTelemetry 相同的概率采样算法**：    
将 traceID 转换成64位整数并取低63位无符号整数，和 osm.tracing.sampledFraction * Math.pow(2, 63) 相比较，  
如果前者小于后者，则需要进行采样处理。  
**采样率使用上游传播方式**  
如果上一节点设置了采样率，则采用上一节点相同的采样率，否者根据采样率计算采样结果。  
