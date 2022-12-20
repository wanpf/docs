# OSM Edge PlugIn 测试

## 1. 下载并安装 osm-edge 命令行工具

```bash
system=$(uname -s | tr [:upper:] [:lower:])
arch=$(dpkg --print-architecture)
release=v1.3.0-alpha.6
curl -L https://github.com/cybwan/osm-edge/releases/download/${release}/osm-edge-${release}-${system}-${arch}.tar.gz | tar -vxzf -
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
    --set=osm.image.registry=cybwan \
    --set=osm.image.tag=1.3.0-alpha.6 \
    --set=osm.image.pullPolicy=Always \
    --set=osm.sidecarLogLevel=error \
    --set=osm.controllerLogLevel=warn \
    --timeout=900s
```

## 3. PlugIn策略测试


### 3.1 部署业务 POD

```bash
kubectl create namespace curl
osm namespace add curl
kubectl apply -n curl -f https://raw.githubusercontent.com/cybwan/osm-edge-start-demo/main/demo/plugin/curl.curl.yaml

kubectl create namespace pipy
osm namespace add pipy
kubectl apply -n pipy -f https://raw.githubusercontent.com/cybwan/osm-edge-start-demo/main/demo/plugin/pipy-ok.pipy.yaml

#等待依赖的 POD 正常启动
sleep 2
kubectl wait --for=condition=ready pod -n curl -l app=curl --timeout=180s
kubectl wait --for=condition=ready pod -n pipy -l app=pipy-ok -l version=v1 --timeout=180s
kubectl wait --for=condition=ready pod -n pipy -l app=pipy-ok -l version=v2 --timeout=180s
```

### 3.2 场景测试

#### 3.2.1 启用Plugin策略

```bash
export osm_namespace=osm-system
kubectl patch meshconfig osm-mesh-config -n "$osm_namespace" -p '{"spec":{"featureFlags":{"enablePluginPolicy":true}}}' --type=merge
```

#### 3.2.2 声明插件

```bash
kubectl apply -f - <<EOF
kind: Plugin
apiVersion: plugin.flomesh.io/v1alpha1
metadata:
  name: token-verifier-1
spec:
  priority: 1
  pipyscript: |+
(
pipy({
  _pluginName: '',
  _pluginConfig: null,
  _accessToken: null,
  _valid: false,
})

.import({
  __port: 'inbound-main',
})

.pipeline()
.onStart(
  () => void (
    _pluginName = __filename.slice(9, -3),
    _pluginConfig = __port?.Plugins?.[_pluginName],
    _accessToken = _pluginConfig?.AccessToken
  )
)
.handleMessageStart(
  msg => (msg.head.headers['accesstoken'] === _accessToken) && (_valid = true)
)
.branch(
  () => _valid, (
    $ => $.chain()
  ), (
    $ => $.replaceMessage(
      new Message({ status: 403 }, 'token verify failed')
    )
  )
)
)
EOF

kubectl apply -f - <<EOF
kind: Plugin
apiVersion: plugin.flomesh.io/v1alpha1
metadata:
  name: token-injector-1
spec:
  priority: 2
  pipyscript: |+
(
pipy({
  _pluginName: '',
  _pluginConfig: null,
  _accessToken: null,
})

.import({
  __port: 'outbound-main',
})

.pipeline()
.onStart(
  () => void (
    _pluginName = __filename.slice(9, -3),
    _pluginConfig = __port?.Plugins?.[_pluginName],
    _accessToken = _pluginConfig?.AccessToken
  )
)
.handleMessageStart(
  msg => _accessToken && (msg.head.headers['accesstoken'] = _accessToken) 
)
.chain()
)
EOF
```

#### 3.2.3 设置插件链

```bash
kubectl apply -n curl -f - <<EOF
kind: PluginChain
apiVersion: plugin.flomesh.io/v1alpha1
metadata:
  name: token-injector-chain-1
spec:
  chains:
    - name: outbound-http
      plugins:
        - token-injector-1
  selectors:
    podSelector:
      matchLabels:
        app: curl
      matchExpressions:
        - key: app
          operator: In
          values: ["curl"]
    namespaceSelector:
      matchExpressions:
        - key: openservicemesh.io/monitored-by
          operator: In
          values: ["osm"]
EOF

kubectl apply -n pipy -f - <<EOF
kind: PluginChain
apiVersion: plugin.flomesh.io/v1alpha1
metadata:
  name: token-verifier-chain-1
spec:
  chains:
    - name: inbound-http
      plugins:
        - token-verifier-1
  selectors:
    podSelector:
      matchLabels:
        app: pipy-ok
      matchExpressions:
        - key: version
          operator: In
          values: ["v1"]
    namespaceSelector:
      matchExpressions:
        - key: openservicemesh.io/monitored-by
          operator: In
          values: ["osm"]
EOF
```

#### 3.2.4 设置插件配置

```bash
kubectl apply -n curl -f - <<EOF
kind: PluginConfig
apiVersion: plugin.flomesh.io/v1alpha1
metadata:
  name: token-injector-config-1
  namespace: curl
spec:
  config:
    token-verifier-1:
      AccessToken: '123456'
  plugin: token-injector-1
  destinationRefs:
    - kind: Service
      name: pipy-ok-v1
      namespace: pipy
EOF

kubectl apply -n pipy -f - <<EOF
kind: PluginConfig
apiVersion: plugin.flomesh.io/v1alpha1
metadata:
  name: token-verifier-config-1
  namespace: pipy
spec:
  config:
    token-verifier-1:
      AccessToken: '123456'
  plugin: token-verifier-1
  destinationRefs:
    - kind: Service
      name: pipy-ok-v1
      namespace: pipy
EOF
```

#### 3.3.5 查看 curl.curl 的 config.json

```bash
curl_client="$(kubectl get pod -n curl -l app=curl -o jsonpath='{.items[0].metadata.name}')"
osm proxy get config_dump -n curl "$curl_client" | jq
```

## 4. 测试 


