# OSM Edge logging 测试

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
    --set=osm.remoteLogging.enable=true \
    --set=osm.remoteLogging.address=10.25.0.100 \
    --set=osm.remoteLogging.port=8123 \
    --set=osm.remoteLogging.authorization="Basic ZGVmYXVsdDoxMjM0NTY=" \
    --set=osm.remoteLogging.sampledFraction=1.0 \
    --timeout=900s
```
