# DNS codec 测试
## 0、编译 pipy
下载版本： https://github.com/wanpf/pipy/tree/v_dns-api-v2   
编译 pipy  
## 1、说明
目前支持 A、AAAA、CNAME、MX、TXT、SOA、PTR、SRV 这些 dns type 可以解析成 JSON 格式，  
对其他的dns请求类型也支持代理转发 （以 HEX 方式对数据进行编码）。  
解析成 json 格式时， dns协议的字段命名，请参考： https://www.ietf.org/rfc/rfc1035.txt 
## 2、pipy js 代码 (dns-main.js)
```bash
((
) => pipy({
})

  //
  // DNS proxy
  //
  .listen(5300, {
    protocol: 'udp',
    transparent: true
  })
  .replaceMessage(
    (msg, dns) => (
      dns = DNS.decode(msg.body),
      console.log('=== request ===\n', JSON.stringify(dns, null, 4)),
      new Message(dns, null)
    )
  )
  .replaceMessage(
    msg => (
      new Message(DNS.encode(msg.head))
    )
  )
  .connect(() => '1.1.1.1:53', {
    protocol: 'udp'
  })
  .replaceMessage(
    (msg, dns) => (
      dns = DNS.decode(msg.body),
      console.log('=== response ===\n', JSON.stringify(dns, null, 4)),
      new Message(dns, null)
    )
  )
  .replaceMessage(
    msg => (
      new Message(DNS.encode(msg.head))
    )
  )

)()
```
## 2、运行 pipy
保存上面的 dns-main.js 文件后，运行如下命令：
```bash
pipy dns-main.js
```
## 3、测试dns查询
```bash
dig @127.0.0.1 -p 5300 www.baidu.com A

dig @127.0.0.1 -p 5300 www.baidu.com AAAA

dig @127.0.0.1 -p 5300 www.baidu.com CNAME

dig @127.0.0.1 -p 5300 baidu.com MX

dig @127.0.0.1 -p 5300 baidu.com TXT

dig @127.0.0.1 -p 5300 baidu.com SOA

dig @127.0.0.1 -p 5300 10.233.105.172.in-addr.arpa PTR

dig @127.0.0.1 -p 5300 _sip._udp.7006581001.siptrunking.appiaservices.com SRV
```
## 4、测试情况, dns 的请求、应答时的 JSON 数据情况
dig @127.0.0.1 -p 5300 www.baidu.com A
```
2022-10-18 08:26:21.246 [INF] === request ===
 {
    "id": 8883,
    "rd": 1,
    "zero": 2,
    "question": [
        {
            "name": "www.baidu.com",
            "type": "A"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 4096,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
2022-10-18 08:26:21.311 [INF] === response ===
 {
    "id": 8883,
    "qr": 1,
    "rd": 1,
    "ra": 1,
    "question": [
        {
            "name": "www.baidu.com",
            "type": "A"
        }
    ],
    "answer": [
        {
            "name": "www.baidu.com",
            "type": "CNAME",
            "ttl": 1199,
            "rdata": "www.a.shifen.com"
        },
        {
            "name": "www.a.shifen.com",
            "type": "CNAME",
            "ttl": 29,
            "rdata": "www.wshifen.com"
        },
        {
            "name": "www.wshifen.com",
            "type": "A",
            "ttl": 299,
            "rdata": "103.235.46.40"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 1232,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
```
dig @127.0.0.1 -p 5300 www.baidu.com AAAA
```
2022-10-18 08:27:40.764 [INF] === request ===
 {
    "id": 51045,
    "rd": 1,
    "zero": 2,
    "question": [
        {
            "name": "www.baidu.com",
            "type": "AAAA"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 4096,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
2022-10-18 08:27:40.825 [INF] === response ===
 {
    "id": 51045,
    "qr": 1,
    "rd": 1,
    "ra": 1,
    "question": [
        {
            "name": "www.baidu.com",
            "type": "AAAA"
        }
    ],
    "answer": [
        {
            "name": "www.baidu.com",
            "type": "CNAME",
            "ttl": 1177,
            "rdata": "www.a.shifen.com"
        },
        {
            "name": "www.a.shifen.com",
            "type": "CNAME",
            "ttl": 7,
            "rdata": "www.wshifen.com"
        }
    ],
    "authority": [
        {
            "name": "wshifen.com",
            "type": "SOA",
            "ttl": 277,
            "rdata": {
                "mname": "ns1.wshifen.com",
                "rname": "baidu_dns_master.baidu.com",
                "serial": 2210150003,
                "refresh": 60,
                "retry": 30,
                "expire": 2592000,
                "minimum": 3600
            }
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 1232,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
```
dig @127.0.0.1 -p 5300 www.baidu.com CNAME
```
2022-10-18 08:28:23.893 [INF] === request ===
 {
    "id": 8897,
    "rd": 1,
    "zero": 2,
    "question": [
        {
            "name": "www.baidu.com",
            "type": "CNAME"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 4096,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
2022-10-18 08:28:23.954 [INF] === response ===
 {
    "id": 8897,
    "qr": 1,
    "rd": 1,
    "ra": 1,
    "question": [
        {
            "name": "www.baidu.com",
            "type": "CNAME"
        }
    ],
    "answer": [
        {
            "name": "www.baidu.com",
            "type": "CNAME",
            "ttl": 703,
            "rdata": "www.a.shifen.com"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 1232,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
```
dig @127.0.0.1 -p 5300 baidu.com MX
```
2022-10-18 08:28:59.324 [INF] === request ===
 {
    "id": 10582,
    "rd": 1,
    "zero": 2,
    "question": [
        {
            "name": "baidu.com",
            "type": "MX"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 4096,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
2022-10-18 08:28:59.389 [INF] === response ===
 {
    "id": 10582,
    "qr": 1,
    "rd": 1,
    "ra": 1,
    "question": [
        {
            "name": "baidu.com",
            "type": "MX"
        }
    ],
    "answer": [
        {
            "name": "baidu.com",
            "type": "MX",
            "ttl": 7200,
            "rdata": {
                "preference": 15,
                "exchange": "mx.n.shifen.com"
            }
        },
        {
            "name": "baidu.com",
            "type": "MX",
            "ttl": 7200,
            "rdata": {
                "preference": 20,
                "exchange": "mx1.baidu.com"
            }
        },
        {
            "name": "baidu.com",
            "type": "MX",
            "ttl": 7200,
            "rdata": {
                "preference": 20,
                "exchange": "jpmx.baidu.com"
            }
        },
        {
            "name": "baidu.com",
            "type": "MX",
            "ttl": 7200,
            "rdata": {
                "preference": 20,
                "exchange": "mx50.baidu.com"
            }
        },
        {
            "name": "baidu.com",
            "type": "MX",
            "ttl": 7200,
            "rdata": {
                "preference": 20,
                "exchange": "usmx01.baidu.com"
            }
        },
        {
            "name": "baidu.com",
            "type": "MX",
            "ttl": 7200,
            "rdata": {
                "preference": 10,
                "exchange": "mx.maillb.baidu.com"
            }
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 1232,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
```
dig @127.0.0.1 -p 5300 baidu.com TXT
```
2022-10-18 08:29:34.949 [INF] === request ===
 {
    "id": 61043,
    "rd": 1,
    "zero": 2,
    "question": [
        {
            "name": "baidu.com",
            "type": "TXT"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 4096,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
2022-10-18 08:29:35.024 [INF] === response ===
 {
    "id": 61043,
    "qr": 1,
    "rd": 1,
    "ra": 1,
    "question": [
        {
            "name": "baidu.com",
            "type": "TXT"
        }
    ],
    "answer": [
        {
            "name": "baidu.com",
            "type": "TXT",
            "ttl": 7200,
            "rdata": "Dgoogle-site-verification=GHb98-6msqyx_qqjGl5eRatD3QTHyVB6-xQ3gJB5UwM"
        },
        {
            "name": "baidu.com",
            "type": "TXT",
            "ttl": 7200,
            "rdata": "J_globalsign-domain-verification=qjb28W2jJSrWj04NHpB0CvgK9tle5JkOq-EcyWBgnE"
        },
        {
            "name": "baidu.com",
            "type": "TXT",
            "ttl": 7200,
            "rdata": "pv=spf1 include:spf1.baidu.com include:spf2.baidu.com include:spf3.baidu.com include:spf4.baidu.com a mx ptr -all"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 1232,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
```
dig @127.0.0.1 -p 5300 baidu.com SOA
```
2022-10-18 08:30:08.691 [INF] === request ===
 {
    "id": 10050,
    "rd": 1,
    "zero": 2,
    "question": [
        {
            "name": "baidu.com",
            "type": "SOA"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 4096,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
2022-10-18 08:30:08.853 [INF] === response ===
 {
    "id": 10050,
    "qr": 1,
    "rd": 1,
    "ra": 1,
    "question": [
        {
            "name": "baidu.com",
            "type": "SOA"
        }
    ],
    "answer": [
        {
            "name": "baidu.com",
            "type": "SOA",
            "ttl": 7200,
            "rdata": {
                "mname": "dns.baidu.com",
                "rname": "sa.baidu.com",
                "serial": 2012145856,
                "refresh": 300,
                "retry": 300,
                "expire": 2592000,
                "minimum": 7200
            }
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 1232,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
```
dig @127.0.0.1 -p 5300 10.233.105.172.in-addr.arpa PTR
```
2022-10-18 08:30:55.820 [INF] === request ===
 {
    "id": 24242,
    "rd": 1,
    "zero": 2,
    "question": [
        {
            "name": "10.233.105.172.in-addr.arpa",
            "type": "PTR"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 4096,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
2022-10-18 08:30:56.441 [INF] === response ===
 {
    "id": 24242,
    "qr": 1,
    "rd": 1,
    "ra": 1,
    "question": [
        {
            "name": "10.233.105.172.in-addr.arpa",
            "type": "PTR"
        }
    ],
    "answer": [
        {
            "name": "10.233.105.172.in-addr.arpa",
            "type": "PTR",
            "ttl": 86400,
            "rdata": "172-105-233-10.ip.linodeusercontent.com"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 1232,
            "ttl": 0,
            "rdata": "000f004000173136322e3135392e32342e32353a35332072636f64653d5245465553454420666f72203130352e3137322e696e2d616464722e6172706120444e534b4559"
        }
    ]
}
```
dig @127.0.0.1 -p 5300 _sip._udp.7006581001.siptrunking.appiaservices.com SRV
```
2022-10-18 08:31:30.596 [INF] === request ===
 {
    "id": 44754,
    "rd": 1,
    "zero": 2,
    "question": [
        {
            "name": "_sip._udp.7006581001.siptrunking.appiaservices.com",
            "type": "SRV"
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 4096,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
2022-10-18 08:31:30.785 [INF] === response ===
 {
    "id": 44754,
    "qr": 1,
    "rd": 1,
    "ra": 1,
    "question": [
        {
            "name": "_sip._udp.7006581001.siptrunking.appiaservices.com",
            "type": "SRV"
        }
    ],
    "answer": [
        {
            "name": "_sip._udp.7006581001.siptrunking.appiaservices.com",
            "type": "SRV",
            "ttl": 900,
            "rdata": {
                "priority": 10,
                "weight": 50,
                "port": 5060,
                "target": "7006581001.siptrunking1.appiaservices.com"
            }
        },
        {
            "name": "_sip._udp.7006581001.siptrunking.appiaservices.com",
            "type": "SRV",
            "ttl": 900,
            "rdata": {
                "priority": 20,
                "weight": 50,
                "port": 5060,
                "target": "7006581001.siptrunking2.appiaservices.com"
            }
        }
    ],
    "additional": [
        {
            "name": "",
            "type": "OPT",
            "class": 1232,
            "ttl": 0,
            "rdata": ""
        }
    ]
}
```
