```shell
export INSTALL_K3S_VERSION=v1.23.8+k3s2
curl -sfL https://get.k3s.io | sh -s - --disable traefik --disable local-storage --disable metrics-server --disable servicelb --write-kubeconfig-mode 644 --write-kubeconfig ~/.kube/config
```

```shell
osm install --timeout 120s
```

```shell
kubectl create ns httpbin
osm namespace add httpbin
kubectl apply -n httpbin -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: httpbin
spec:
  ports:
    - name: pipy
      port: 8080
      targetPort: 8080
      protocol: TCP
  selector:
    app: pipy
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin-v1
spec:
  ports:
    - name: pipy
      port: 8080
      targetPort: 8080
      protocol: TCP
  selector:
    app: pipy
    version: v1
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin-v2
spec:
  ports:
    - name: pipy
      port: 8080
      targetPort: 8080
      protocol: TCP
  selector:
    app: pipy
    version: v2
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin-v1
  labels:
    app: pipy
    version: v1
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pipy
      version: v1
  template:
    metadata:
      labels:
        app: pipy
        version: v1
    spec:
      containers:
        - name: pipy
          image: flomesh/pipy:latest
          ports:
            - name: pipy
              containerPort: 8080
          command:
            - pipy
            - -e
            - |
              pipy()
              .listen(8080)
              .serveHTTP(new Message('Hi, I am v1!\n'))
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin-v2
  labels:
    app: pipy
    version: v2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pipy
      version: v2
  template:
    metadata:
      labels:
        app: pipy
        version: v2
    spec:
      containers:
        - name: pipy
          image: flomesh/pipy:latest
          ports:
            - name: pipy
              containerPort: 8080
          command:
            - pipy
            - -e
            - |
              pipy()
              .listen(8080)
              .serveHTTP(new Message('Hi, I am v2!\n'))
EOF
```

```shell
kubectl create ns curl
osm namespace add curl
kubectl apply -n curl -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: curl
  labels:
    app: curl
    service: curl
spec:
  ports:
    - name: http
      port: 80
  selector:
    app: curl
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: curl
spec:
  replicas: 1
  selector:
    matchLabels:
      app: curl
  template:
    metadata:
      labels:
        app: curl
    spec:
      containers:
      - image: curlimages/curl
        imagePullPolicy: IfNotPresent
        name: curl
        command: ["sleep", "365d"]
EOF
```

```shell
kubectl wait --for=condition=ready pod --all -A
```

```shell
curl_client="$(kubectl get pod -n curl -l app=curl -o jsonpath='{.items[0].metadata.name}')"
kubectl exec "$curl_client" -n curl -c curl -- curl -si httpbin.httpbin:8080
```

```shell
kubectl apply -n httpbin -f - <<EOF
apiVersion: split.smi-spec.io/v1alpha4
kind: TrafficSplit
metadata:
  name: httpbin-split
spec:
  service: httpbin
  backends:
  - service: httpbin-v1
    weight: 75
  - service: httpbin-v2
    weight: 25
EOF
```

```shell
kubectl exec "$curl_client" -n curl -c curl -- curl -s httpbin.httpbin:8080/test httpbin.httpbin:8080/test httpbin.httpbin:8080/test httpbin.httpbin:8080/test
Hi, I am v1!
Hi, I am v2!
Hi, I am v1!
Hi, I am v1!
```

```shell
kubectl exec "$curl_client" -n curl -c curl -- curl -s httpbin.httpbin:8080/demo httpbin.httpbin:8080/demo httpbin.httpbin:8080/demo httpbin.httpbin:8080/demo
Hi, I am v1!
Hi, I am v2!
Hi, I am v1!
Hi, I am v1!
```

```shell
kubectl apply -n httpbin -f - <<EOF
apiVersion: specs.smi-spec.io/v1alpha4
kind: HTTPRouteGroup
metadata:
  name: httpbin-test
spec:
  matches:
  - name: test
    pathRegex: "/test"
    methods:
    - GET
EOF
```

```shell
kubectl apply -n httpbin -f - <<EOF
apiVersion: split.smi-spec.io/v1alpha4
kind: TrafficSplit
metadata:
  name: httpbin-split
spec:
  service: httpbin
  matches:
  - name: httpbin-test
    kind: HTTPRouteGroup
  backends:
  - service: httpbin-v1
    weight: 75
  - service: httpbin-v2
    weight: 25
EOF
```

```shell
kubectl exec "$curl_client" -n curl -c curl -- curl -s httpbin.httpbin:8080/test httpbin.httpbin:8080/test httpbin.httpbin:8080/test httpbin.httpbin:8080/test
Hi, I am v2!
Hi, I am v1!
Hi, I am v2!
Hi, I am v1!
```

不符合预期，应该是 3 个 v1, 1 个 v2。

```shell
kubectl exec "$curl_client" -n curl -c curl -- curl -s httpbin.httpbin:8080/demo httpbin.httpbin:8080/demo httpbin.httpbin:8080/demo httpbin.httpbin:8080/demo
Hi, I am v2!
Hi, I am v1!
Hi, I am v2!
Hi, I am v1!
```

符合预期。
