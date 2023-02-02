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

## 3. 部署 booksdemo 
```bash


# create namespace

kubectl create namespace bookwarehouse --save-config
osm namespace add --mesh-name osm bookwarehouse
osm metrics enable --namespace bookwarehouse

kubectl create namespace bookstore --save-config
osm namespace add --mesh-name osm bookstore
osm metrics enable --namespace bookstore

kubectl create namespace bookbuyer --save-config
osm namespace add --mesh-name osm bookbuyer
osm metrics enable --namespace bookbuyer

kubectl create namespace bookthief --save-config
osm namespace add --mesh-name osm bookthief
osm metrics enable --namespace bookthief

# deploy mysql

kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: mysql
  namespace: bookwarehouse
---
apiVersion: v1
kind: Service
metadata:
  name: mysql
  namespace: bookwarehouse
spec:
  ports:
  - port: 3306
    targetPort: 3306
    name: client
    appProtocol: tcp-server-first
  selector:
    app: mysql
  clusterIP: None
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: bookwarehouse
spec:
  serviceName: mysql
  replicas: 1
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      serviceAccountName: mysql
      nodeSelector:
        kubernetes.io/os: linux
      containers:
      - image: devilbox/mysql:mysql-8.0
        name: mysql
        env:
        - name: MYSQL_ROOT_PASSWORD
          value: mypassword
        - name: MYSQL_DATABASE
          value: booksdemo
        ports:
        - containerPort: 3306
          name: mysql
        volumeMounts:
        - mountPath: /mysql-data
          name: data
        readinessProbe:
          tcpSocket:
            port: 3306
          initialDelaySeconds: 15
          periodSeconds: 10
      volumes:
        - name: data
          emptyDir: {}
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 250M
---
kind: TrafficTarget
apiVersion: access.smi-spec.io/v1alpha3
metadata:
  name: mysql
  namespace: bookwarehouse
spec:
  destination:
    kind: ServiceAccount
    name: mysql
    namespace: bookwarehouse
  rules:
  - kind: TCPRoute
    name: mysql
  sources:
  - kind: ServiceAccount
    name: bookwarehouse
    namespace: bookwarehouse
---
apiVersion: specs.smi-spec.io/v1alpha4
kind: TCPRoute
metadata:
  name: mysql
  namespace: bookwarehouse
spec:
  matches:
    ports:
    - 3306
EOF

# deploy bookwarehouse


KUBE_CONTEXT=$(kubectl config current-context)

kubectl delete deployment bookwarehouse -n bookwarehouse  --ignore-not-found

kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: bookwarehouse
  namespace: bookwarehouse
EOF

kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: bookwarehouse
  namespace: bookwarehouse
  labels:
    app: bookwarehouse
spec:
  ports:
  - port: 14001
    name: bookwarehouse-port

  selector:
    app: bookwarehouse
EOF

kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bookwarehouse
  namespace: bookwarehouse
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bookwarehouse
  template:
    metadata:
      labels:
        app: bookwarehouse
        version: v1
    spec:
      serviceAccountName: bookwarehouse
      containers:
        # Main container with APP
        - name: bookwarehouse
          image: flomesh/osm-edge-demo-bookwarehouse
          imagePullPolicy: Always
          command: ["/bookwarehouse"]
          env:
            - name: IDENTITY
              value: bookwarehouse.${KUBE_CONTEXT}
EOF

# deploy bookstore-v1

KUBE_CONTEXT=$(kubectl config current-context)

kubectl delete deployment bookstore-v1 -n bookstore  --ignore-not-found

kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: bookstore
  namespace: bookstore
  labels:
    app: bookstore
spec:
  ports:
  - port: 14001
    name: bookstore-port
  selector:
    app: bookstore
EOF

kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: bookstore-v1
  namespace: bookstore
EOF

kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: bookstore-v1
  namespace: bookstore
  labels:
    app: bookstore
    version: v1
spec:
  ports:
  - port: 14001
    name: bookstore-port
  selector:
    app: bookstore
    version: v1
EOF

kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bookstore-v1
  namespace: bookstore
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bookstore
      version: v1
  template:
    metadata:
      labels:
        app: bookstore
        version: v1
    spec:
      serviceAccountName: bookstore-v1
      containers:
        - image: flomesh/osm-edge-demo-bookstore
          imagePullPolicy: Always
          name: bookstore
          ports:
            - containerPort: 14001
              name: web
          command: ["/bookstore"]
          args: ["--port", "14001"]
          env:
            - name: IDENTITY
              value: bookstore-v1.${KUBE_CONTEXT}
            - name: BOOKWAREHOUSE_NAMESPACE
              value: bookwarehouse

          # OSM's mutating webhook will rewrite this liveness probe to /osm-liveness-probe and
          # Sidecar will have a dedicated listener on port 15901 for this liveness probe
          livenessProbe:
            httpGet:
              path: /liveness
              port: 14001
            initialDelaySeconds: 3
            periodSeconds: 3

          # OSM's mutating webhook will rewrite this readiness probe to /osm-readiness-probe and
          # Sidecar will have a dedicated listener on port 15902 for this readiness probe
          readinessProbe:
            failureThreshold: 10
            httpGet:
              path: /readiness
              port: 14001
              scheme: HTTP

          # OSM's mutating webhook will rewrite this startup probe to /osm-startup-probe and
          # Sidecar will have a dedicated listener on port 15903 for this startup probe
          startupProbe:
            httpGet:
              path: /startup
              port: 14001
            failureThreshold: 30
            periodSeconds: 5
EOF

# deploy bookstore-v2

KUBE_CONTEXT=$(kubectl config current-context)

kubectl delete deployment bookstore-v2 -n bookstore  --ignore-not-found

kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: bookstore
  namespace: bookstore
  labels:
    app: bookstore
spec:
  ports:
  - port: 14001
    name: bookstore-port
  selector:
    app: bookstore
EOF

kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: bookstore-v2
  namespace: bookstore
EOF

kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: bookstore-v2
  namespace: bookstore
  labels:
    app: bookstore
    version: v2
spec:
  ports:
  - port: 14001
    name: bookstore-port
  selector:
    app: bookstore
    version: v2
EOF

kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bookstore-v2
  namespace: bookstore
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bookstore
      version: v2
  template:
    metadata:
      labels:
        app: bookstore
        version: v2
    spec:
      serviceAccountName: bookstore-v2
      containers:
        - image: flomesh/osm-edge-demo-bookstore
          imagePullPolicy: Always
          name: bookstore
          ports:
            - containerPort: 14001
              name: web
          command: ["/bookstore"]
          args: ["--port", "14001"]
          env:
            - name: IDENTITY
              value: bookstore-v2.${KUBE_CONTEXT}
            - name: BOOKWAREHOUSE_NAMESPACE
              value: bookwarehouse

          # OSM's mutating webhook will rewrite this liveness probe to /osm-liveness-probe and
          # Sidecar will have a dedicated listener on port 15901 for this liveness probe
          livenessProbe:
            httpGet:
              path: /liveness
              port: 14001
            initialDelaySeconds: 3
            periodSeconds: 3

          # OSM's mutating webhook will rewrite this readiness probe to /osm-readiness-probe and
          # Sidecar will have a dedicated listener on port 15902 for this readiness probe
          readinessProbe:
            failureThreshold: 10
            httpGet:
              path: /readiness
              port: 14001
              scheme: HTTP

          # OSM's mutating webhook will rewrite this startup probe to /osm-startup-probe and
          # Sidecar will have a dedicated listener on port 15903 for this startup probe
          startupProbe:
            httpGet:
              path: /startup
              port: 14001
            failureThreshold: 30
            periodSeconds: 5
EOF

# deploy bookbuyer

kubectl delete deployment bookbuyer -n bookbuyer  --ignore-not-found

kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: bookbuyer
  namespace: bookbuyer
EOF

kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bookbuyer
  namespace: bookbuyer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bookbuyer
      version: v1
  template:
    metadata:
      labels:
        app: bookbuyer
        version: v1
    spec:
      serviceAccountName: bookbuyer
      containers:
        # Main container with APP
        - name: bookbuyer
          image: flomesh/osm-edge-demo-bookbuyer
          imagePullPolicy: Always
          command: ["/bookbuyer"]

          env:
            - name: "BOOKSTORE_NAMESPACE"
              value: bookstore
            - name: "BOOKSTORE_SVC"
              value: bookstore
EOF

# deploy bookthief


kubectl delete deployment bookthief -n bookthief  --ignore-not-found

kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: bookthief
  namespace: bookthief
EOF

kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: bookthief
  namespace: bookthief
  labels:
    app: bookthief
spec:
  ports:

  - port: 9999
    name: dummy-unused-port

  selector:
    app: bookthief

---

apiVersion: apps/v1
kind: Deployment
metadata:
  name: bookthief
  namespace: bookthief
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bookthief
  template:
    metadata:
      labels:
        app: bookthief
        version: v1
    spec:
      serviceAccountName: bookthief
      containers:
        # Main container with APP
        - name: bookthief
          image: flomesh/osm-edge-demo-bookthief
          imagePullPolicy: Always
          command: ["/bookthief"]

          env:
            - name: "BOOKSTORE_NAMESPACE"
              value: bookstore
            - name: "BOOKSTORE_SVC"
              value: bookstore
EOF

# policy


kubectl apply -f - <<EOF
apiVersion: specs.smi-spec.io/v1alpha4
kind: HTTPRouteGroup
metadata:
  name: bookstore-service-routes
  namespace: bookstore
spec:
  matches:
  - name: books-bought
    pathRegex: /books-bought
    methods:
    - GET
    headers:
    - "user-agent": ".*-http-client/*.*"
    - "client-app": "bookbuyer"
  - name: buy-a-book
    pathRegex: ".*a-book.*new"
    methods:
    - GET
  - name: update-books-bought
    pathRegex: /update-books-bought
    methods:
    - POST
EOF

kubectl apply -f - <<EOF
apiVersion: specs.smi-spec.io/v1alpha4
kind: HTTPRouteGroup
metadata:
  name: bookwarehouse-service-routes
  namespace: bookwarehouse
spec:
  matches:
    - name: restock-books
      methods:
      - POST
EOF


kubectl apply -f - <<EOF
kind: TrafficTarget
apiVersion: access.smi-spec.io/v1alpha3
metadata:
  name: bookbuyer-access-bookstore-v1
  namespace: bookstore
spec:
  destination:
    kind: ServiceAccount
    name: bookstore-v1
    namespace: bookstore
  rules:
  - kind: HTTPRouteGroup
    name: bookstore-service-routes
    matches:
    - buy-a-book
    - books-bought
  sources:
  - kind: ServiceAccount
    name: bookbuyer
    namespace: bookbuyer


# TrafficTarget is deny-by-default policy: if traffic from source to destination is not
# explicitly declared in this policy - it will be blocked.
# Should we ever want to allow traffic from bookthief to bookstore the block below needs
# uncommented.

# - kind: ServiceAccount
#   name: bookthief
#   namespace: bookthief


---

kind: TrafficTarget
apiVersion: access.smi-spec.io/v1alpha3
metadata:
  name: bookbuyer-access-bookstore-v2
  namespace: bookstore
spec:
  destination:
    kind: ServiceAccount
    name: bookstore-v2
    namespace: bookstore
  rules:
  - kind: HTTPRouteGroup
    name: bookstore-service-routes
    matches:
    - buy-a-book
    - books-bought
  sources:
  - kind: ServiceAccount
    name: bookbuyer
    namespace: bookbuyer


# TrafficTarget is deny-by-default policy: if traffic from source to destination is not
# explicitly declared in this policy - it will be blocked.
# Should we ever want to allow traffic from bookthief to bookstore the block below needs
# uncommented.

# - kind: ServiceAccount
#   name: bookthief
#   namespace: bookthief

---

kind: TrafficTarget
apiVersion: access.smi-spec.io/v1alpha3
metadata:
  name: bookstore-access-bookwarehouse
  namespace: bookwarehouse
spec:
  destination:
    kind: ServiceAccount
    name: bookwarehouse
    namespace: bookwarehouse
  rules:
  - kind: HTTPRouteGroup
    name: bookwarehouse-service-routes
    matches:
    - restock-books
  sources:
  - kind: ServiceAccount
    name: bookstore-v1
    namespace: bookstore
  - kind: ServiceAccount
    name: bookstore-v2
    namespace: bookstore

EOF




```













