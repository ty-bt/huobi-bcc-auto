/**
 * 如果要交易功能，浏览器必须已经登录火币网
 * 代码中有两个 account-id 自己去火币网找对应的操作试一遍 填上去， 两个id不一样
 * Created by 勇 on 2017/8/22 0022.
 */
(function(){
    var main = angular.module("main", []);

    // 登录火币网 随便找个请求 在request header中找token 没有这个是没办法操作的
    var token = "";
    // 自动运行 目标利差 达到这个则自动交易
    var targetLX = 1.2;
    // 自动交易使用的人民币数量
    var amount = 500;
    var chartData = {
        btc: [],
        cny: []
    };
    var myChart = echarts.init(document.getElementById('chart'));
    var option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                animation: false
            }
        },
        legend: {
            data:['BCC/CNY','BCC/BTC/CNY']
        },
        xAxis: {
            type: 'time',
            splitLine: {
                show: false
            }
        },
        yAxis: {
            type: 'value',
            boundaryGap: [0, '100%'],
            min: "dataMin",
            max: "dataMax",
            splitLine: {
                show: false
            }
        },
        series: [{
            name: 'BCC/CNY',
            type: 'line',
            data: chartData.cny,
            showSymbol: false,
            hoverAnimation: false
        }, {
            name: 'BCC/BTC/CNY',
            type: 'line',
            data: chartData.btc,
            showSymbol: false,
            hoverAnimation: false
        }]
    };
    myChart.setOption(option);
    chrome.webRequest.onBeforeSendHeaders.addListener(function(details){
        var isReferer = false;
        var isToken = false;
        var isXHR = false;
        // 伪造来源
        for (var i = 0; i < details.requestHeaders.length; ++i) {
            if (details.requestHeaders[i].name === 'Origin') {
                details.requestHeaders[i].value = "https://www.huobi.com";
            }
            if (details.requestHeaders[i].name === 'Referer') {
                isReferer = true;
            }
            if (details.requestHeaders[i].name === 'Token') {
                isToken = true;
            }
            if (details.requestHeaders[i].name === 'X-Requested-With') {
                isXHR = true;
            }
        }
        if(!isReferer){
            details.requestHeaders.push({name: "Referer", value: "https://www.huobi.com/trade/cny_btc"});
        }
        if(!isToken){
            details.requestHeaders.push({name: "Token", value: token});
        }
        if(!isXHR){
            details.requestHeaders.push({name: "X-Requested-With", value: "XMLHttpRequest"});
        }
        return {requestHeaders: details.requestHeaders};
    }, {
        urls: ["https://*.huobi.com/*"]
    }, ["blocking", "requestHeaders"]);
    chrome.webRequest.onBeforeSendHeaders.addListener(function(details){
        var isReferer = false;
        var isToken = false;
        // 伪造来源
        for (var i = 0; i < details.requestHeaders.length; ++i) {
            if (details.requestHeaders[i].name === 'Origin') {
                details.requestHeaders[i].value = "https://www.huobi.pro";
            }
            if (details.requestHeaders[i].name === 'Referer') {
                isReferer = true;
            }
            if (details.requestHeaders[i].name === 'Token') {
                isToken = true;
            }
        }
        if(!isReferer){
            details.requestHeaders.push({name: "Referer", value: "https://www.huobi.pro/exchange/bcc_btc/"});
        }
        if(!isToken){
            details.requestHeaders.push({name: "Token", value: token});
        }
        return {requestHeaders: details.requestHeaders};
    }, {
        urls: ["https://api.huobi.pro/*"]
    }, ["blocking", "requestHeaders"]);

    main.run(['$rootScope', function($rootScope){
        $rootScope.reloadHQ = function(url, typeArr, callback){
            var webSocket = new WebSocket(url);
            webSocket.binaryType = "arraybuffer";
            webSocket.onopen = function(event){
                console.log(("webSocket connect at time: "+new Date()));
                $(typeArr).each(function(){
                    webSocket.send(JSON.stringify({'sub': 'market.' + this + '.detail','id': 'depth ' + new Date()}));
                });
            };
            webSocket.onmessage = function(event){
                var raw_data = event.data;
                window.raw_data = raw_data;
                var ua = new Uint8Array(raw_data);
                var json = pako.inflate(ua,{to:"string"});
                var data = JSON.parse(json);
                if(data["ping"]){
                    webSocket.send(JSON.stringify({"pong":data["ping"]}));
                }
                else{
                    if(data.ch){
                        var tick = data.tick;
                        // $("#nowPrice").html(data.tick.close);
                        // $("#nowAmount").html(data.tick.amount+tick.count);
                        // $("#zhangfu").html((Math.floor((tick.close-tick.open)/tick.open*100*100)/100)+"%")

                        $rootScope.$apply(function(){
                            $rootScope[typeArr[0]] = data;
                            callback && callback(data, typeArr[0]);

                            $rootScope.btcbccCB = $rootScope.bccbtc.tick.close * $rootScope.btccny.tick.close;
                            $rootScope.liCha = $rootScope.bcccny.tick.close - $rootScope.btcbccCB;
                            var liChaLv= $rootScope.liCha / $rootScope.btcbccCB * 100;
                            $rootScope.changeChaLv = liChaLv - $rootScope.liChaLv;
                            $rootScope.liChaLv = liChaLv;
                            $rootScope.autoJiaoYi();
                            chartData.cny.push({name: $rootScope.liChaLv, value: [new Date($rootScope[typeArr[0]].ts), $rootScope.bcccny.tick.close]});
                            chartData.btc.push({name: $rootScope.btcbccCB, value: [new Date($rootScope[typeArr[0]].ts), $rootScope.btcbccCB]});
                            if(chartData.cny.length > 300){
                                chartData.cny.shift();
                                chartData.btc.shift();
                            }
                            myChart.setOption({
                                series: [{
                                    name: 'BCC/CNY',
                                    type: 'line',
                                    data: chartData.cny
                                }, {
                                    name: 'BCC/BTC/CNY',
                                    type: 'line',
                                    data: chartData.btc
                                }]
                            });
                        });
                    }
                }
            };

            webSocket.onclose = function(){
                console.log("webSocket connect is closed");
                console.log(arguments);
            };

            webSocket.onerror = function(){
                console.log("error");
                console.log(arguments);
            };
        };

        $rootScope.autoJiaoYi = function(){
            if($rootScope.openAuto && $rootScope.liChaLv >= targetLX && !$rootScope.autoStatus){
                $rootScope.autoStatus = true;
                console.log("进入等待, 利差" + $rootScope.liChaLv + "%");
                setTimeout(function(){
                    if($rootScope.liChaLv < targetLX){
                        $rootScope.autoStatus = false;
                        $rootScope.$apply("autoStatus");
                        console.log("波动过快\t" + $rootScope.liChaLv + "%");
                        return;
                    }
                    console.log("利差\t" + $rootScope.liChaLv + "%");
                    console.log($rootScope.bccbtc.tick, $rootScope.btccny.tick, $rootScope.bcccny.tick);
                    $rootScope.jiaoYi().then(function(){
                        console.log("执行成功，请检查");
                        $rootScope.$apply(function(){
                            $rootScope.autoStatus = false;
                            $rootScope.openAuto && $rootScope.autoJiaoYi();
                        });
                    }, function(){
                        console.log("执行失败失败失败，请检查, 关闭自动交易..")
                        $rootScope.$apply(function(){
                            $rootScope.openAuto = false;
                            $rootScope.autoStatus = false;
                        });
                    });
                }, 2000);

            }
        };


        // ETH/CNY、ETC/CNY Websocket行情请求地址为：wss://be.huobi.com/ws
        // BTC/CNY、LTC/CNY Websocket行情请求地址为：wss://api.huobi.com/ws
        // ETH/BTC、LTC/BTC、ETC/BTC、BCC/BTC 行情请求地址为：wss://api.huobi.pro/ws
        $rootScope.reloadHQ("wss://be.huobi.com/ws", ['bcccny'], function(data){
            // console.log(data);
        });
        $rootScope.reloadHQ("wss://api.huobi.com/ws", ['btccny'], function(data){
        });
        $rootScope.reloadHQ("wss://api.huobi.pro/ws", ['bccbtc'], function(data){
        });

        /**
         * 等待委托成功
         * @param type
         */
        var weituo = function(type){
            var def = $.Deferred();
            var urlHash = {
                "bcc/btc": "https://api.huobi.pro/v1/order/orders?symbol=bccbtc&states=submitted,partial-filled&size=6&",
                "bcc/cny": "https://be.huobi.com/v1/order/orders?symbol=bcccny&states=submitted,partial-filled&size=6&",
                "btc": "https://www.huobi.com/trade/entrust_ajax?coin_type=cny_btc&is_history=0&r=" + Math.random()

            };
            if(!urlHash[type]){
                console.log("委托类型不存在:", type);
                def.reject();
            }else{
                var reloadWeiTuo = function(count){
                    $.ajax({
                        url: urlHash[type]
                    }).then(function(data){
                        if(data.status === "ok" || data.code === 0){
                            var length;
                            if(type == "btc"){
                                length = data.delegation.length
                            }else{
                                length = data.data.length
                            }

                            if(!length){
                                def.resolve(length);
                            }else if(length > 1){
                                console.log("委托单异常，委托数量超过1", 1, type);
                                def.reject();
                            }else{
                                console.log("委托未成功,第" + count + "重试", type)
                                // 没有达到目标 则继续查询
                                setTimeout(function(){
                                    reloadWeiTuo(count + 1)
                                }, 150);
                            }
                        }else{
                            console.log("查询委托异常", type)
                            def.reject();
                        }

                    });
                };
                reloadWeiTuo(1);
            }
            return def;
        };

        /**
         * 获取账户余额
         * @param accountType 账户类型
         * @param cType 货币类型
         * @param min 最小值, 低于这个值将会继续查询
         * @returns {*}
         */
        var yuE = function(accountType, cType, min){
            var urls = {
                cx: "https://be.huobi.com/v1/account/accounts/517014/balance?r=" + Math.random(),
                zy: "https://api.huobi.pro/v1/account/accounts/377248/balance?r=" + Math.random(),
                main: "https://www.huobi.com/account/ajax.php?coin_type=cny_btc&m=user_balance&r=" + Math.random()
            };
            var def = $.Deferred();
            if(!urls[accountType]){
                console.log("账户类型不存在:", accountType);
                def.reject();
            }else{
                var reloadBalance = function(count){
                    // if(count >= 10){
                    //     console.log("重试10次没有达到目标值，请手动操作...");
                    //     def.reject();
                    //     return;
                    // }
                    $.ajax({
                        url: urls[accountType]
                    }).then(function(data){
                        if(data.status === "ok" || data.code === 0){
                            var balance;
                            if(accountType == "main"){
                                balance = parseFloat(data.ext.CNY[cType].available);
                            }else{
                                $(data.data.list).each(function(){
                                    if(this.currency == cType && this.type == "trade"){
                                        balance = parseFloat(this.balance);
                                    }
                                });
                            }
                            if(isNaN(balance)){
                                console.log("没有找到对应类型的余额", accountType, cType)
                                def.reject();
                                return;
                            }
                            if(isNaN(min) || balance >= min){
                                def.resolve(balance);
                            }else{
                                console.log("小于目标值,第" + count + "重试", min, balance)
                                // 没有达到目标 则继续查询
                                setTimeout(function(){
                                    reloadBalance(count + 1)
                                }, 100);
                            }
                        }else{
                            console.log("查询余额请求异常")
                            def.reject();
                        }

                    });
                };
                reloadBalance(1);

            }
            return def;
        };

        /**
         *
         * @param num 划转的金额
         */
        var hz = function(num){

            // 创新区账户-主站
            // https://be.huobi.com/v1/dw/withdraw-legal/create  {"amount":"1000","currency":"cny"}
        };

        var dataIsError = function(data){
            var deferred = $.Deferred();
            if(data.status !== "ok" && data.code !== 0){
                console.log("数据异常", data);
                deferred.reject();
            }else{
                deferred.resolve(data);
            }
            return deferred;
        };

        var xiaoshu = function(num, ws){
            var fNum = Math.pow(10, ws);
            return parseInt(num * fNum) / fNum;
        };

        $rootScope.jiaoYi = function(){
            var startDate = new Date();
            // 初始金额
            var initBalance;

            // 判断余额
            return yuE('main', 'CNY', amount).then(function(balance){
                // 购买比特币
                console.log("购买比特币:" + amount, "账户余额:" + balance)
                initBalance = balance;
                return $.ajax({
                    url: "https://www.huobi.com/trade/do_buy?st=trade_trade",
                    type: "post",
                    data: {
                        coin_type: 'cny_btc',
                        order_type: 'PlaceMarketOrder',
                        _csrf: '599cd927f1420',
                        price: $rootScope.btccny.tick.close,
                        market_transaction_amount: amount,
                        price_mp: "",
                        amount: "",
                        trade_pwd: ""
                    }
                })

            }).then(dataIsError).then(function(){
                return weituo("btc");
            }).then(function(data){
                return yuE('main', 'BTC', 0.00005)
                    .then(function(balance){
                        console.log("比特币转到专业站:" + balance, balance * $rootScope.btccny.tick.close)

                        // 比特币转到专业站
                        return $.ajax({
                            url: "https://api.huobi.pro/v1/dw/transfer-in/create",
                            type: "post",
                            data: JSON.stringify({
                                "amount": balance,
                                "currency":"btc"
                            }),
                            contentType:'application/json; charset=UTF-8',
                        });
                    }).then(dataIsError).then(function(data){
                        // 比特币转到专业站 交易确认
                        return $.ajax({
                            url: "https://api.huobi.pro/v1/dw/transfer-in/" + data.data + "/place",
                            type: "post"
                        });
                    });

            }).then(dataIsError).then(function(data){
                // 比特币购买bcc
                return yuE('zy', 'btc', 0.0001)
                    .then(function(balance){
                        console.log("比特币购买bcc:" + balance, balance * $rootScope.btccny.tick.close)
                        return $.ajax({
                            url: "https://api.huobi.pro/v1/order/orders",
                            type: "post",
                            data: JSON.stringify({
                                "symbol":"bccbtc",
                                "account-id": "", // 自己登录后进行这个操作去看 两个用户id不一样的
                                "amount": xiaoshu(balance, 6),
                                "type":"buy-market",
                                "source":"web"
                            }),
                            contentType:'application/json; charset=UTF-8',
                        });
                    }).then(dataIsError).then(function(data){
                        // 交易确认
                        return $.ajax({
                            url: "https://api.huobi.pro/v1/order/orders/" +　data.data +　"/place",
                            type: "post"
                        });
                    });

            }).then(dataIsError).then(function(){
                return weituo("bcc/btc");
            }).then(function(data){
                // bcc转到创新区
                return yuE('zy', 'bcc', 0.0001)
                    .then(function(balance){
                        console.log("bcc转到创新区:" + balance, balance * $rootScope.bcccny.tick.close)
                        return $.ajax({
                            url: "https://api.huobi.pro/v1/dw/transfer-out/create",
                            type: "post",
                            data: JSON.stringify({
                                "amount": xiaoshu(balance, 4),
                                "currency":"bcc"
                            }),
                            contentType:'application/json; charset=UTF-8',
                        });
                    }).then(dataIsError).then(function(data){
                        // 交易确认
                        return $.ajax({
                            url: "https://api.huobi.pro/v1/dw/transfer-out/" +　data.data +　"/place",
                            type: "post"
                        });
                    });
            }).then(dataIsError).then(function(data){
                // bcc换人民币
                return yuE('cx', 'bcc', 0.0001)
                    .then(function(balance){
                        console.log("bcc换人民币:" + balance, balance * $rootScope.bcccny.tick.close)

                        // 限价交易
                        // return $.ajax({
                        //     url: "https://be.huobi.com/v1/order/orders",
                        //     type: "post",
                        //     data: JSON.stringify({
                        //         "account-id":517014,
                        //         "amount": xiaoshu(balance, 4),
                        //         price: xiaoshu($rootScope.bcccny.tick.close, 2) + 0.01,
                        //         "type":"sell-limit",
                        //         "source":"web",
                        //         symbol: "bcccny"
                        //     }),
                        //     contentType:'application/json; charset=UTF-8',
                        // });
                        // 市价交易
                        return $.ajax({
                            url: "https://be.huobi.com/v1/order/orders",
                            type: "post",
                            data: JSON.stringify({
                                "symbol":"bcccny",
                                "account-id": "",   //// 自己登录后进行这个操作去看 两个用户id不一样的
                                "amount": xiaoshu(balance, 4),
                                "type":"sell-market",
                                "source":"web"
                            }),
                            contentType:'application/json; charset=UTF-8',
                        });
                    })
                    .then(dataIsError).then(function(data){
                        // 交易确认
                        return $.ajax({
                            url: "https://be.huobi.com/v1/order/orders/" +　data.data +　"/place",
                            type: "post"
                        });
                    });
            }).then(dataIsError).then(function(){
                return weituo("bcc/cny");
            }).then(function(data){
                // 人民币转到主站
                return yuE('cx', 'cny', 1)
                    .then(function(balance){
                        console.log("人民币转到主站:" + balance)
                        return $.ajax({
                            url: "https://be.huobi.com/v1/dw/withdraw-legal/create",
                            type: "post",
                            data: JSON.stringify({
                                amount: xiaoshu(balance, 2),
                                currency: "cny"
                            }),
                            contentType:'application/json; charset=UTF-8'
                        });
                    })
                    .then(dataIsError).then(function(data){
                        // 交易确认
                        return $.ajax({
                            url: "https://be.huobi.com/v1/dw/withdraw-legal/" +　data.data +　"/place",
                            type: "post"
                        });
                    });
            }).then(dataIsError).then(function(){
                return yuE('main', 'CNY', initBalance - amount + amount / 2).then(function(balance){
                    var shouYi = balance - initBalance;
                    console.log("收益：" + shouYi + "\t 收益率：" + (shouYi / amount * 100) + "%\t用时：" + ((new Date().getTime() - startDate.getTime()) / 1000) + "s")
                })
            });
        }
    }]);
})();
