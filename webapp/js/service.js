var servicesModule = angular.module('facetalk.Services',[]);

servicesModule.factory('$ionicStorage',function($rootScope){
    return {
        max:{
            notices:10,//最多10条提醒 - 本地存储中唯一jid的用户，只显示最新的一条
            perCons:20//每个用户最多20条
        },
        set:function(message,isMe){//message = {jid:,name:,text:,url:}
            if(!this.facexin) this.init();//初始化

            var notices = this.facexin.notices,xins = this.facexin.xins;
            var jid = message.jid,found = false,index;
            
            //处理新消息
            for(var i = 0; i < notices.length; i++){
                var notice = notices[i],n_jid = notice.jid;
                if(jid == n_jid){
                    found = true;
                    index = i;
                    break;
                }
            }
            if(!isMe){
                if(found) notices.splice(i,1); //每人只存一条最新的，删除已有
                notices.unshift(message);
                if(notices.length > this.max.notices) notices.slice(0,this.max.notices);
            }

            //处理聊天记录
            var xin = xins[jid],list;
            if(!xin) xins[jid] = {'unreaded':0,'name':message.name,'lists':[]};
            if(!isMe){
                xins[jid]['unreaded'] += 1;
                $rootScope.$apply(function(){
                    $rootScope.badgeCounts = ($rootScope.badgeCounts || 0) + 1;//Tab消息条数加1
                })
            }

            list = {'text':message.text,'url':message.url};
            xins[jid]['lists'] = xins[jid]['lists'] || [];
            xins[jid]['lists'].push(list);

            if(xins[jid]['lists'].length > this.max.perCons){
                //如果超出max，cookie只存储max属性，但是xins对象中全部存上
                 xins[jid]['lists'] = xins[jid]['lists'].slice(-this.max.perCons + 1);
            }
            Storage.set('facexin',this.facexin);

            if(!isMe) $rootScope.$broadcast('news',message);
        },
        init:function(){
            var my_jid = $rootScope.userInfo.username;
            this.facexin = Storage.get('facexin') || {jid:$rootScope.userInfo.username,notices:[],xins:{}};
            if(!this.facexin || this.facexin.jid != my_jid){//如果发现本地数据不是当前用户，则里面删除本地数据
                Storage.remove('facexin');
                this.facexin = {jid:my_jid,notices:[],xins:{}}
            }
        }
    }
}).factory('$ionicNotice',function($ionicTip,$http){
    return {
        init:function(){
            try{//过滤Android里面奇怪的错误
                if(Notification){
                    if(Notification.permission == 'granted'){
                    }else if(Notification.permission != 'denied'){
                        $ionicTip.show('请点击允许使用桌面通知，方便及时收到好友的视频请求').timeout();
                        Notification.requestPermission(function(status) {
                            if(Notification.permission !== status) {
                                Notification.permission = status;
                            }
                            if(status == 'granted'){
                                $http.get('/log_gif/desktop_notice.gif?agree')
                            }else if(status == 'denied'){
                                $http.get('/log_gif/desktop_notice.gif?reject')
                            }
                        });
                    }
                }
            }catch(e){}
        },
        setNotice:function(jid,nick){
            var msg1 = '▣ ' + nick + ' 想和您视频通话',msg2 = '◈ ' + nick + ' 想和您视频通话',itv,i = 1;
            try{//过滤Android里面奇怪的错误
                if(Notification && Notification.permission == 'granted'){
                    new Notification('来电提醒',{
                        'icon':'/avatar/' + jid + '.100.png',
                        'body':nick + ' 想和您视频通话'
                    })
                }
            }catch(e){}

            document.title = msg1;
            itv = setInterval(function(){
                var msg = (i%2 == 0 ? msg1 : msg2);
                i++;
                document.title = msg;
                if(i == 7){
                    clearInterval(itv);
                    document.title = '脸呼 - 在线视频聊天交友平台';
                    i = 0;
                }
            },1000)
        }
    }
}).factory('$ionicRecord',function($interval){
    return {
        run:function(options,callback){
            var video = options.video,w = video.offsetWidth,h = video.offsetHeight;
            if(!video) return;

            var canvas = document.createElement('canvas'),ctx = canvas.getContext('2d');
            canvas.width = w;
            canvas.height = h;

            var encoder = new GIFEncoder(),times = (options.times || 2) * 1000,snapshoot = options.snapshoot || 10;
            var delay = parseInt(times/snapshoot);//计算出快照的时间间隔
            encoder.setRepeat(0);
            encoder.setDelay(delay);
            encoder.start();

            $interval(function(){
                ctx.drawImage(video,0,0,w,h)
                encoder.addFrame(ctx);
            },delay,snapshoot).then(function(){
                encoder.finish();

                var binary_gif = encoder.stream().getData();
                var data = 'data:image/gif;base64,'+encode64(binary_gif);
                if(callback && typeof callback == 'function'){
                    callback(data);
                }
            });
        },
        showTimer:function(elm,timer){
            if(!_$('recording')){
                var div = document.createElement('div');
                div.id = 'recording';
                div.className = 'recording hidden';
                div.innerHTML = '<div class="bg"></div><div class="cons"><span class="shine"></span> 录制中 ... <span>' + timer + '</span>秒</div>';
                elm.appendChild(div);
            }
            var recording = angular.element(_$('recording')),left = recording.find('span').eq(1),i = timer;
            recording.removeClass('hidden');

            $interval(function(){
                left.html(--i);
            },1000,timer).then(function(){
                left.html(timer);
                recording.addClass('hidden');
            })
        }
    }
}).factory('$ionicStatus',function(){
    return {
        isFree:0,
        isWaiting:1,
        isContinue:2,
        isChatting:3
    }
}).factory('$ionicClient',function($rootScope){
    var userAgent = navigator.userAgent,
        supportVideo = ($rootScope.supportVideo = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia),
        isIOS = ($rootScope.isIOS = /(?:iphone|ipad)/i.test(userAgent)),
        isPC = ($rootScope.isPC = !(/(?:mobile|android|iphone)/i.test(userAgent))),
        isMAC = ($rootScope.isMAC = /macintosh/i.test(userAgent));
        
    return {
        supportVideo:supportVideo,
        isIOS:isIOS,
        isPC:isPC,
        isMAC:isMAC
    }
}).factory('$ionicTip',function($ionicLoading,$timeout){
    return {
        show:function(msg,noBg){
            var bl = true;
            if(noBg == 'false') bl = false;
            if(this.timer) $timeout.cancel(this.timer);
            $ionicLoading.show({template:msg,noBackdrop:bl})
            return this;
        },
        hide:function(){
            if(this.timer) $timeout.cancel(this.timer);
            $ionicLoading.hide();
        },
        timeout:function(timeout,callback){
            var timeout = timeout || 2000;
            this.timer = $timeout(function(){
                $ionicLoading.hide();
                if(typeof callback == 'function') callback();
            },timeout)
        }
    }
}).factory('$validor',function($ionicTip){
    return {
        msgs:{
            emailRequired:'邮箱地址不能为空',
            email:'请输入正确的邮箱地址',
            pwdRequired:'请输入密码',
            pwd:'密码格式错误:6~16位字符,区分大小写',
            nameRequired:'昵称不能为空',
            name:'昵称格式错误:4~18位汉字或英文字符'
        },
        login:function(form){
            var email = form.loginEmail,pwd = form.loginPassword,msgs = this.msgs,msg;
            if(email.$invalid){
                var errors = email.$error;
                if(errors.required){
                    msg = msgs.emailRequired;
                }else if(errors.email){
                    msg = msgs.email;
                }
            }else if(pwd.$invalid){
                msg = msgs.pwdRequired;
            }
            $ionicTip.show(msg).timeout();
        },
        regist:function(form){
            var email = form.email,pwd = form.password,name = form.name,msgs = this.msgs,msg;
            if(email.$invalid){
                var errors = email.$error;
                if(errors.required){
                    msg = msgs.emailRequired;
                }else if(errors.email){
                    msg = msgs.email;
                }
            }else if(name.$invalid){
                var errors = name.$error;
                if(errors.required){
                    msg = msgs.nameRequired;
                }else{
                    msg = msgs.name;
                }
            }else if(pwd.$invalid){
                var errors = pwd.$error;
                if(errors.required){
                    msg = msgs.pwdRequired;
                }else{
                    msg = msgs.pwd;
                }
            }
            $ionicTip.show(msg).timeout();
        }
    }
}).factory('$ionicUser',function($rootScope,$http,$ionicTip,$ionicXmpp){
    return {
        getInfo:function(name,cb){
            return $http.get('/api/user/get/' + name).success(function(data){
                $rootScope.userInfo = data;
                $rootScope.isLogin = true;
                $rootScope.isComplete = (data.infoCompleteness == 1);

                if(data.infoCompleteness == 1) $ionicXmpp.bind.call($ionicXmpp,data.username);

                if(typeof cb == 'function') cb();
            })
        },
        login:function(email,pwd,cb){
            var para = 'loginEmail=' + email + '&loginPassword=' + pwd,self = this;
            $http.post('/login',para).success(function(data){
                var status = data.status;
                if(status == 'success'){//登录成功
                    var username = data.username || Storage.cookie.get('_fh_username');
                    self.getInfo(username,cb);
                }else{//登录失败
                    $ionicTip.show('邮箱地址或密码错误').timeout();
                }
            }).error(function(){})
        },
        regist:function(name,pwd,email,cb){
            var para = 'name=' + name + '&password=' + pwd + '&email=' + email,self = this;
            $http.post('/api/user/register',para).success(function(data){
                var status = data.status;
                if(status == 'success'){
                    return self.login(email,pwd,cb)//自动登录
                }else{
                    $ionicTip.show(data.desc).timeout();
                }
            }).error(function(){})
        }
    }
}).factory('$ionicXmpp',function($rootScope,$http,$state,$ionicPopup,$ionicNavBarDelegate,$ionicTip,$ionicNotice,$ionicStorage,$filter){
    return {
        server:'/http-bind',
        status:0,
        xmpp:null,
        popup:null,
        connection:null,
        bind:function(name){
            var self = this;
            $http.get('/api/user/loginForXmpp/' + name).success(function(data){
                var con = new Strophe.Connection(self.server);
                self.xmpp = data;
                self.connection = con
                con.attach(data.jid,data.sid,data.rid,function(status){
                    self.connecting.call(self,status);
                });
            }).error(function(body,status){
                if(status == 403){
                    $rootScope.isLogin = false;
                    $rootScope.isComplete = false;
                    Storage.cookie.remove('_fh_username');
                }
            })
        },
        connecting:function(status){
            if(status == Strophe.Status.ATTACHED){//登录xmpp成功
                var self = this,con = self.connection;
                con.send($pres().c('show').t('chat'));//空闲

                con.addHandler(self.online,null,'presence');

                con.addHandler(function(message){
                    self.message.call(self,message)
                    return true;
                },null,'message','chat');

            }else{
            }
        },
        online:function(){
            $http.get('/xmpp/get/allonline').success(function(data){
                if(/\s*null\s*/.test(data)) return;
                var arr = data.split(','),items = [];
                for(var i = 0; i < arr.length; i++){
                    var jid = arr[i],username = jid.split('@')[0],url = username + '.100.png';
                    items.push({jid:jid,username:username,imgUrl:url})
                }
                $rootScope.online = items;
                $rootScope.$broadcast('scroll.refreshComplete');

                return true;
            })
        },
        setStatus:function(status){
            var con = this.connection;
            if(status == 0){
                con.send($pres().c('show').t('chat'));
            }else if(status == 1 || status == 2 || status == 3){
                con.send($pres().c('show').t('dnd'));
            }
            this.status = status;
        },
        sendSignal:function(signal,from,to){
            var con = this.connection,
                from_jid = from.jid,from_nick = from.nick,
                to_jid = to.jid,to_nick = to.nick,
                self = this;

            con.send($msg({type:'chat',to:to_jid + '@facetalk',nick:from_nick,time:new Date().getTime()}).c('body').t(signal));

            if(signal == 'video'){
                self.setStatus(1);
                $ionicTip.show('正在发送视频请求，请勿刷新页面 ...','false').timeout(30000,function(){
                    self.sendSignal('timeout',from,to);
                }); 
            }else if(signal == 'ok'){
                self.setStatus(3);
                $state.go('tabs.chat',{roomid:to_jid + '_' + from_jid,nick:encodeURI(to_nick)})
            }else if(signal == 'no'){
                self.setStatus(0);
            }else if(signal == 'busy'){
            }else if(signal == 'timeout'){
                $ionicPopup.confirm({
                    title:'超时通知',
                    template:'对方未响应，请稍后重试 ...',
                    okText:'给TA留言',
                    cancelText:'确定'
                }).then(function(res){
                    self.setStatus(0);
                    if(res) $state.go('tabs.xin-detail',{jid:to_jid,name:encodeURI(to_nick)});
                });
            }
        },
        message:function(message){
            var from_info = message.getAttribute('from'),f_jid = from_info.split('@')[0],gifId = message.getAttribute('gifid'),signal = message.childNodes[0].innerHTML,nick = message.getAttribute('nick'),self = this;

            if(gifId){//脸呼消息
                var h1 = gifId.substring(0,2),h2 = gifId.substring(2,4),news = {'jid':f_jid,'name':nick,'url':'/faceSmsGif/' + h1 + '/' + h2 + '/' + gifId  + '.gif',text:signal};//对方的jid和nick
                $ionicStorage.set(news);
            }else{
                var from_jid = $rootScope.userInfo.username,from_nick = $rootScope.userInfo.name;
                var from = {jid:from_jid,nick:from_nick},to = {jid:f_jid,nick:nick};

                if(signal == 'video'){
                    if(self.status != 0){
                        self.sendSignal('busy',from,to);
                        return;
                    }
                    self.setStatus(2);
                    $ionicPopup.confirm({
                        title:'来电提醒',
                        template:'<div id="videoPOP" class="row request"><div class="col col-33 col-center"><img src="/avatar/' + f_jid + '.png"/></div><div class="col col-67"><strong>' + nick + '</strong> 想和您进行视频聊天</div></div>',
                        okText:'同意',
                        cancelText:'拒绝'
                    }).then(function(res){
                        res ? self.sendSignal('ok',from,to) : self.sendSignal('no',from,to);  
                    })
                    
                    $ionicNotice.setNotice(f_jid,nick);//设置通知
                    _$('noticeAd').play();
                }else if(signal == 'ok'){
                    var roomid = self.xmpp.jid.split('@')[0] + '_' + f_jid;
                    self.setStatus(3);

                    /history/.test(location.hash) ? $state.go('tabs.history.chat',{roomid:roomid}) : $state.go('tabs.chat',{roomid:roomid,nick:encodeURI(nick)})
                }else if(signal == 'no'){
                    $ionicTip.hide();//关闭等待请求提示
                    $ionicPopup.confirm({
                        title:'脸呼消息',
                        template:'对方拒绝了您的请求 ...',
                        okText:'给TA留言',
                        cancelText:'确定'
                    }).then(function(res){
                        self.setStatus(0);
                        if(res) $state.go('tabs.xin-detail',{jid:f_jid,name:encodeURI(nick)})
                    })

                }else if(signal == 'busy'){
                    $ionicTip.hide();
                    $ionicPopup.confirm({
                        title:'脸呼消息',
                        template:'对方正在通话中，请稍后再试 ...',
                        okText:'给TA留言',
                        cancelText:'确定'
                    }).then(function(res){
                        self.setStatus(0);
                        if(res) $state.go('tabs.xin-detail',{jid:f_jid,name:encodeURI(nick)})
                    })
                }else if(signal == 'timeout'){
                    var time = message.getAttribute('time'),f_time = $filter('date')(time,'HH:mm');
                    $ionicPopup.confirm({
                        title:'未接来电',
                        template:'<div class="row request"><div class="col col-33 col-center"><img src="/avatar/' + f_jid + '.png"/></div><div class="col col-67"><strong>' + nick + '</strong> 与 ' + f_time + ' 呼叫过您</div></div>',
                        okText:'回拨',
                        cancelText:'确定'
                    }).then(function(res){
                        var videoPop = _$('videoPOP');
                        if(videoPop){
                            var pop = angular.element(videoPop).parent().parent();
                            pop[0].previousSibling.className = 'backdrop';
                            pop.remove();
                        }

                        self.setStatus(0);
                        if(res) self.sendSignal('video',from,to);
                    })
                }else{
                    if(signal == 'PermissionDeniedError'){//对方关闭了摄像头
                        $ionicTip.show('对方拒绝开启摄像装备，将无法和对方建立连接，请点击左上角结束 ...').timeout(5000);
                    }
                }
            }
        }
    }
}).factory('$ionicVideo',function($rootScope,$http,$ionicNavBarDelegate,$ionicLoading,$ionicXmpp,$ionicTip,$timeout){
    var isEnder;
    return {
        stream:null,
        loadVideo:function(elm,openVideoTip,success,error){
            var self = this,elm = elm || _$('face');
            if(openVideoTip){
                $ionicTip.show(openVideoTip);
            }else{
                if($rootScope.isPC){//开启摄像头提醒
                    $ionicTip.show('请看上面的浏览器提示<img src="images/icons/arrow.png"/>，点击“允许”按钮，否则您无法完成注册');
                }else{
                    $ionicTip.show('请按照浏览器提示，允许使用摄像头以完成注册');
                }
            }

            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
            navigator.getUserMedia({video:true,audio:false}, function(stream){
                var video = elm;
                $ionicTip.hide();
                window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
                video.src = window.URL.createObjectURL(stream);
                self.stream = stream;
                if(success && typeof success == 'function'){
                    success();
                }else{
                    $ionicTip.hide();
                    $timeout(function(){
                        $ionicTip.show('请确保自拍头像清晰完整。注意，系统会删除不符合要求的头像。').timeout(3000);
                    },500)
                }
            },function(err){
                console.log(err);
                if(error && typeof error == 'function'){
                    error(err);
                }else{
                    $ionicTip.show('浏览器未能开启摄像头，请按此<a class="link" target="_blank" href="http://tieba.baidu.com/p/3234947658">（链接）</a>说明，开启摄像头以完成注册。');
                }
            });
        },
        take:function(){
            var videoStream = this.stream,video = document.getElementById('face'),take = document.getElementById('take'),choose = document.getElementById('choose');
            if(!videoStream) return;
            video.pause();
            take.className = 'hidden';
            choose.className = 'row';
        },
        choose:function(callback){
            var video = document.getElementById('face'),w = video.offsetWidth,h = video.offsetHeight,name = $rootScope.userInfo.username,self = this;
            var canvas = document.createElement('canvas'),ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 260;
            ctx.drawImage(video,-(w-200)/2,0,w,h);

            var para = 'username=' + name + '&picData=' + encodeURIComponent(canvas.toDataURL());
            $http.post('/api/user/savePic',para).success(function(data){
                var status = data.status;
                if(status == 'success'){
                    self.stream.stop();
                    self.stream = null;
                    $rootScope.isComplete = true;
                    if(!$ionicXmpp.connection) $ionicXmpp.bind.call($ionicXmpp,name);
                    //2秒后返回
                    $timeout(function(){
                        $ionicLoading.hide();
                        if(callback && typeof callback == 'function') callback();
                    },2000)
                }else{
                    $ionicLoading.show({template:data.desc});
                }
            }).error(function(){
            })

            $ionicLoading.show({
                template:'<em class="ion-loading-c"></em>&nbsp;&nbsp;正在保存您的头像，即将完成 ...'
            });
        },
        reset:function(){
            var video = document.getElementById('face'),take = document.getElementById('take'),choose = document.getElementById('choose');
            choose.className = 'hidden';
            take.className = '';
            video.play();
        },
        initRTC:function(opts){
            var roomid = opts.roomid,vid;
            var con = $ionicXmpp.connection,m_jid = $rootScope.userInfo.username;
            var webrtc = $ionicXmpp.webrtc;

            if(!webrtc){
                webrtc = ($ionicXmpp.webrtc =  new SimpleWebRTC({
                    url:'https://www.facehu.cn:8888',
                    localVideoEl:'local',
                    remoteVideosEl:'remote',
                    autoRequestMedia:true
                }));

                webrtc.on('readyToCall', function () {
                    webrtc.joinRoom(roomid);
                });
                webrtc.on('videoAdded',function(){
                    $ionicTip.hide();
                    //假设有视频发起者记录聊天时间
                    if(roomid.indexOf(m_jid) == 0){
                        $http.get('/api/pay/chatRecord/begin/' + roomid.replace('_','/')).success(function(data){
                            vid = data.id;
                        }).error(function(){
                        })
                    }
                }) 
                webrtc.on('videoRemoved',function(){
                    if(!isEnder){//如果不是自己结束聊天
                        $ionicTip.show('对方已挂断，请点击“挂断”按钮返回 ...').timeout(5000);
                        isEnder = true;
                    }else{
                        $ionicXmpp.setStatus(0);
                    }

                    if(vid){//记录结束时间，并结算
                        $http.get('/api/pay/chatRecord/end/' + vid);
                        //$http.get('/api/pay/chatTransaction/' + vid);
                    }
                })
                webrtc.on('localMediaError',function(err){
                    var name = err.name,jid = roomid.replace(m_jid,'').replace('_','');
                    con.send($msg({type:'chat',to:jid + '@facetalk'}).c('body').t(name));
                    if(name == 'PermissionDeniedError'){
                        $ionicTip.show('浏览器未能开启摄像头，请按此<a class="link" target="_blank" href="http://tieba.baidu.com/p/3234947658">（链接）</a>说明，开启摄像头 ...').timeout(5000);
                    }
                    $ionicXmpp.setStatus(0);
                })
            }else{
                webrtc.startLocalVideo();
            }
        },
        cancelRTC:function(){
            var webrtc = $ionicXmpp.webrtc;
            isEnder = true;

            webrtc.stopLocalVideo();
            webrtc.leaveRoom();
            $ionicNavBarDelegate.back();
        }
    }
})
