## 基于 java spring boot 的demo， 演示HTTP追踪日志 ##
## 1. 下载并安装 osm-edge 命令行工具
```bash
system=$(uname -s | tr [:upper:] [:lower:])
arch=$(dpkg --print-architecture)
release=v1.3.0
curl -L https://github.com/flomesh-io/osm-edge/releases/download/${release}/osm-edge-${release}-${system}-${arch}.tar.gz | tar -vxzf -
./${system}-${arch}/osm version
cp ./${system}-${arch}/osm /usr/local/bin/
```
## 2. 安装 osm-edge
```bash
export osm_namespace=osm-system 
export osm_mesh_name=osm 

osm install \
    --mesh-name "$osm_mesh_name" \
    --osm-namespace "$osm_namespace" \
    --set=osm.certificateProvider.kind=tresor \
    --set=osm.image.registry=flomesh \
    --set=osm.image.tag=1.3.0 \
    --set=osm.image.pullPolicy=Always \
    --set=osm.sidecarLogLevel=warn \
    --set=osm.controllerLogLevel=warn \
    --set=osm.deployJaeger="true" \
    --set=osm.tracing.enable="true" \
    --set=osm.tracing.address="jaeger.osm-system.svc.cluster.local:9411" \
    --set=osm.tracing.sampledFraction=1.0 \
    --timeout=900s
```
## 3. 部署服务
```bash
# namespace

kubectl create namespace java-tracing
osm namespace add java-tracing

# 9090

kubectl -n java-tracing apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: www-9090
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: www-9090
spec:
  replicas: 1
  selector:
    matchLabels:
      app: www-9090
  template:
    metadata:
      labels:
        app: www-9090
    spec:
      serviceAccountName: www-9090
      containers:
      - env:
        - name: SERVER_PORT
          value: "9090"
        image: wanpf/java-tracing-client
        imagePullPolicy: IfNotPresent
        name: www-9090
      dnsPolicy: ClusterFirst
      restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  labels:
    service: www-9090
  name: www-9090
spec:
  ipFamilies:
  - IPv4
  ports:
  - name: web
    port: 9090
    protocol: TCP
    appProtocol: http
    targetPort: 9090
  type: ClusterIP
  selector:
    app: www-9090
EOF

# 9091

kubectl -n java-tracing apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: www-9091
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: www-9091
spec:
  replicas: 1
  selector:
    matchLabels:
      app: www-9091
  template:
    metadata:
      labels:
        app: www-9091
    spec:
      serviceAccountName: www-9091
      containers:
      - env:
        - name: SERVER_PORT
          value: "9091"
        image: wanpf/java-tracing-client
        imagePullPolicy: IfNotPresent
        name: www-9091
      dnsPolicy: ClusterFirst
      restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  labels:
    service: www-9091
  name: www-9091
spec:
  ipFamilies:
  - IPv4
  ports:
  - name: web
    port: 9091
    protocol: TCP
    appProtocol: http
    targetPort: 9091
  type: ClusterIP
  selector:
    app: www-9091
EOF

# 9092

kubectl -n java-tracing apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: www-9092
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: www-9092
spec:
  replicas: 1
  selector:
    matchLabels:
      app: www-9092
  template:
    metadata:
      labels:
        app: www-9092
    spec:
      serviceAccountName: www-9092
      containers:
      - env:
        - name: SERVER_PORT
          value: "9092"
        image: wanpf/java-tracing-client
        imagePullPolicy: IfNotPresent
        name: www-9092
      dnsPolicy: ClusterFirst
      restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  labels:
    service: www-9092
  name: www-9092
spec:
  ipFamilies:
  - IPv4
  ports:
  - name: web
    port: 9092
    protocol: TCP
    appProtocol: http
    targetPort: 9092
  type: ClusterIP
  selector:
    app: www-9092
EOF

# 9093

kubectl -n java-tracing apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: www-9093
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: www-9093
spec:
  replicas: 1
  selector:
    matchLabels:
      app: www-9093
  template:
    metadata:
      labels:
        app: www-9093
    spec:
      serviceAccountName: www-9093
      containers:
      - env:
        - name: SERVER_PORT
          value: "9093"
        image: wanpf/java-tracing-server
        imagePullPolicy: IfNotPresent
        name: www-9093
      dnsPolicy: ClusterFirst
      restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
  labels:
    service: www-9093
  name: www-9093
spec:
  ipFamilies:
  - IPv4
  ports:
  - name: web
    port: 9093
    protocol: TCP
    appProtocol: http
    targetPort: 9093
  type: ClusterIP
  selector:
    app: www-9093
EOF

# curl

kubectl apply -n java-tracing -f https://raw.githubusercontent.com/cybwan/osm-edge-start-demo/main/demo/plugin/curl.curl.yaml

```
### 4. 访问 java 服务 ###
```bash
curl_client="$(kubectl get pod -n java-tracing -l app=curl -o jsonpath='{.items[0].metadata.name}')"
kubectl exec ${curl_client} -n java-tracing -c curl -- curl -ksi http://www-9090.java-tracing.svc.cluster.local:9090/fetchAndStore/9090
```
  
### 5. 其他说明 ###  

#### 1. 参数说明 ####
| 参数 | 说明 | 默认值 |
| :-----:| :----: | :----: |
| osm.deployJaeger | 是否部署 jaeger 服务 | false |
| osm.tracing.enable | 是否启用 jaeger tracing | false |
| osm.tracing.address | jaeger 服务地址 | 空 |
| osm.tracing.sampledFraction | 采样率 | 1.0 |
#### 2. 采样说明 ####
**追踪日志的 trace id 和 span id 均由8个字节（64 bits）的数值表示**，如下：    
"traceId":"1e2d1e9531fe404c","id":"d6887727c1e94889"    
**采用和 OpenTelemetry 相同的概率采样算法**：    
将 traceID 转换成64位整数并取低63位无符号整数，和 osm.tracing.sampledFraction * Math.pow(2, 63) 相比较，  
如果前者小于后者，则需要进行采样处理。  
**采样率使用上游传播方式**  
如果上一节点设置了采样率，则采用上一节点相同的采样率，否者根据采样率计算采样结果。  
#### 3. java 工程需要引入 sleuth 依赖包 ####  
```bash
<!-- https://mvnrepository.com/artifact/org.springframework.cloud/spring-cloud-starter-sleuth -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-sleuth</artifactId>
    <version>1.2.6.RELEASE</version>
</dependency> 
```
  
    
