## osm-edge 启用 ClickHouse 存储HTTP日志 ##
### 1. 配置参数 ###
在安装 osm-edge 时，需要配置如下参数：  
举例：具体参数需要根据实际情况进行修改  
```bash
--set=osm.remoteLogging.enable=true 
--set=osm.remoteLogging.address=192.168.122.249 
--set=osm.remoteLogging.port=8123 
--set=osm.remoteLogging.authorization="Basic ZGVmYXVsdDoxMjM0NTY=" 
--set=osm.remoteLogging.sampledFraction=1.0 
```
### 2. 参数说明 ###
| 参数 | 说明 | 默认值 |
| :-----:| :----: | :----: |
| osm.remoteLogging.enable | 是否开启logging日志 | false |
| osm.remoteLogging.address | ClickHouse服务地址（ip或域名） | 空 |
| osm.remoteLogging.port | ClickHouse服务端口 | 空 |
| osm.remoteLogging.authorization | ClickHouse用户名、密码 | 空 |
| osm.remoteLogging.sampledFraction | 采样率 | 1.0 |
### 3. 采样说明 ###
**日志的 trace id 和 span id 均由8个字节（64 bits）的数值表示**，如下：    
"traceId":"1e2d1e9531fe404c","id":"d6887727c1e94889"    
**采用和 OpenTelemetry 相同的概率采样算法**：    
将 traceID 转换成64位整数并取低63位无符号整数，和 osm.remoteLogging.sampledFraction * Math.pow(2, 63) 相比较，  
如果前者小于后者，则需要进行采样处理。  
**独立计算采样结果**  
每个节点都独立计算结果，不受上一节点传播的采样结果影响。  
如果将logging日志用于追踪分析，那么链路日志的完整性取决于链路中设置的最低采样率。  
