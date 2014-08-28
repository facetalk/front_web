var servicesModule = angular.module('facetalk.Services',[]);

servicesModule.factory('$ionicStorage',function($rootScope){
    return {
        max:{
            notices:10,//最多10条提醒 - 本地存储中唯一jid的用户，只显示最新的一条
            perCons:20//每个用户最多10条
        },
        set:function(message){//message = {jid:,name:,text:,url:}
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
            if(found) notices.splice(i,1); //每人只存一条最新的，删除已有
            notices.unshift(message);
            if(notices.length > this.max.notices) notices = notices.slice(0,this.max.notices);

            //处理聊天记录
            var xin = xins[jid],list;
            if(!xin) xins[jid] = {'unreaded':0,'name':message.name,'lists':[]};
            if(!message.isMe) xins[jid]['unreaded'] += 1;

            list = {'text':message.text,'url':message.url};
            if(message.isMe) list.isMe = true;
            xins[jid]['lists'].push(list);

            if(xins[jid]['lists'].length > this.max.perCons){
                //如果超出max，cookie只存储max属性，但是xins对象中全部存上
                xins[jid]['lists'] = xins[jid]['lists'].slice(0,this.max.perCons);
            }
            Storage.set('facexin',this.facexin);

            $rootScope.$broadcast('news',message)//broadcast给xinCtrl

            $rootScope.$apply(function(){
                $rootScope.badgeCounts = ($rootScope.badgeCounts || 0) + 1;//Tab消息条数加1
            })
        },
        init:function(){
            this.facexin = Storage.get('facexin') || {notices:[],xins:{}};
        }
    }
}).factory('$ionicNotice',function($ionicTip,$http){
    return {
        init:function(){
            var self = this;
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
            var msg1 = '▣ ' + nick + ' 请求和您视频通话',msg2 = '◈ ' + nick + ' 请求和您视频通话',itv,i = 1;
            try{//过滤Android里面奇怪的错误
                if(Notification && Notification.permission == 'granted'){
                    new Notification('脸呼通知',{
                        'icon':'/avatar/' + jid + '.100.png',
                        'body':nick + ' 请求和您视频通话'
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
}).factory('$ionicXin',function($http,$ionicVideo,$ionicXmpp,$ionicTip,$ionicStorage){
    var waiting = false;
    return {
        show:function(m_jid,jid,nick){
            var self = this;
            if(!_$('facexinPop')){
                var div = document.createElement('div');
                div.className = 'facexinPop';
                div.id = 'facexinPop';
                div.innerHTML = '<video autoplay></video><div class="counter hidden" id="counter">2</div><div id="inputWrapper" class="inputWrapper hidden"><div class="title">回车发送消息 + 表情动画(2s)</div><div class="con"><input id="xin_put" type="text" placeholder="请输入文字内容 - 字数最多50字"></div></div><i class="xin-close ion-close-round" id="xin-close"></i>';
                document.body.appendChild(div);

                var gif = _$('facexinPop').getElementsByTagName('video')[0],input = _$('xin_put'),close = _$('xin-close');
                input.addEventListener('keydown',function(e){
                    var keyCode = e.keyCode || e.which;
                    if(keyCode == 13){
                          if(input.value.length > 50){
                              $ionicTip.show('最多允许输入50个字符').timeout();
                          }else{
                              _$('counter').className = 'counter';
                             self.to(m_jid,jid,nick);
                          }
                    }
                },false)
                close.addEventListener('click',function(e){
                    e.preventDefault();
                    self.close();
                },false)
                gif.addEventListener('canplaythrough',function(){
                    setTimeout(function(){
                        _$('inputWrapper').className = 'inputWrapper';
                        input.focus();
                    },50)
                },false)
            }else{
                _$('facexinPop').className = 'facexinPop';
            }
            var gif = _$('facexinPop').getElementsByTagName('video')[0];
            $ionicVideo.loadVideo(gif);
        },
        close:function(){
            if(waiting) return;//正在录制Gif，不允许关闭
            if($ionicVideo.stream){
                $ionicVideo.stream.stop();
                $ionicVideo.stream = null;

                setTimeout(function(){
                    _$('facexinPop').className = 'faceXinDown';
                },500)
            }
        },
        to:function(m_jid,jid,nick){
            var encoder = new GIFEncoder(),canvas = document.createElement('canvas'),ctx = canvas.getContext('2d'),i = 0,self = this;
            var face = _$('facexinPop').getElementsByTagName('video')[0];
            waiting = true;//正在录Gif时，不允许关闭

            _$('counter').className = 'counter';

            canvas.width = face.offsetWidth;
            canvas.height = face.offsetHeight;
            encoder.setRepeat(0); 
            encoder.setDelay(200);
            encoder.start();

            var itv = setInterval(function(){//2秒10帧
                if(i == 10){
                    clearInterval(itv);
                    encoder.finish();
                    waiting = false;

                    _$('counter').className = 'counter hidden';
                    _$('counter').innerHTML = '2';

                    var binary_gif = encoder.stream().getData();
                    var data_url = 'data:image/gif;base64,'+encode64(binary_gif);
                    var time = new Date().getTime(),gifId = m_jid + '_' + time;
                    var para = 'picData=' + encodeURIComponent(data_url) + '&gifId=' + gifId;

                    $http.post('/api/facesms/saveGif',para).success(function(data){
                        var status = data.status;
                        if(status == 'success'){
                            $ionicXmpp.connection.send($msg({type:'chat',to:jid + '@facetalk',gifid:gifId,nick:nick}).c('body').t(_$('xin_put').value))

                            var message = {'jid':jid,'name':nick,'url':'/faceSmsGif/' + gifId.substring(0,2) + '/' + gifId.substring(2,4) + '/' + gifId  + '.gif','text':_$('xin_put').value,'isMe':true};
                            $ionicStorage.set(message)

                            _$('xin_put').value = '';
                        }
                    })
                }else{
                    ctx.drawImage(face,0,0,face.offsetWidth,face.offsetHeight)
                    encoder.addFrame(ctx);
                    if(i == 5){
                        _$('counter').innerHTML = '1';
                    }
                    i++
                }
            },200)
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
            nameRequired:'用户名不能为空',
            name:'用户名格式错误:4~18位汉字或英文字符'
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
            var self = this;
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
                    $ionicTip.show(data.desc).timeout();
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
}).factory('$ionicXmpp',function($rootScope,$http,$state,$ionicPopup,$ionicNavBarDelegate,$ionicTip,$ionicNotice,$ionicStorage){
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
        message:function(message){
            //console.log(message);
            var con = this.connection,from = message.getAttribute('from'),f_jid = from.split('@')[0],gifId = message.getAttribute('gifid'),signal = message.childNodes[0].innerHTML,self = this;
            var msg = $msg({type:'chat',to:from}).c('body');

            //脸呼消息
            if(gifId){
                var nick = message.getAttribute('nick');
                var h1 = gifId.substring(0,2),h2 = gifId.substring(2,4),news = {'jid':f_jid,'name':nick,'url':'/faceSmsGif/' + h1 + '/' + h2 + '/' + gifId  + '.gif',text:signal};

                $ionicStorage.set(news);

            }else{
                if(signal == 'video'){
                    var nick = message.getAttribute('nick');
                    if(self.status != 0){
                        con.send(msg.t('busy'))
                        return;
                    }

                    con.send($pres().c('show').t('dnd'));
                    self.status = 2;

                    self.popup = $ionicPopup.confirm({
                        title:'提示信息',
                        template:'<div class="row request"><div class="col col-33 col-center"><img src="/avatar/' + f_jid + '.png"/></div><div class="col col-67"><strong>' + nick + '</strong> 请求和您进行视频聊天，是否同意</div></div>',
                        okText:'同意',
                        cancelText:'拒绝'
                    });
                    self.popup.then(function(res){
                        if(res){
                            var roomid = f_jid + '_' + self.xmpp.jid.split('@')[0];

                            con.send(msg.t('ok'));
                            self.status = 3;

                            $state.go('tabs.chat',{roomid:roomid})
                        }else{
                            con.send(msg.t('no'))
                            con.send($pres().c('show').t('chat'));
                            self.status = 0;
                        }
                    })
                    
                    $ionicNotice.setNotice(f_jid,nick);//设置通知
                    _$('noticeAd').play();
                }else if(signal == 'ok'){
                    var roomid = self.xmpp.jid.split('@')[0] + '_' + f_jid;

                    con.send($pres().c('show').t('dnd'));
                    self.status = 3;

                    /history/.test(location.hash) ? $state.go('tabs.history.chat',{roomid:roomid}) : $state.go('tabs.chat',{roomid:roomid})
                }else if(signal == 'no'){
                    $ionicTip.show('对方拒绝了您的请求').timeout();

                    con.send($pres().c('show').t('chat'));
                    self.status = 0;
                }else if(signal == 'busy'){
                    $ionicTip.show('对方正在通话中，请稍后再试 ...').timeout();

                    con.send($pres().c('show').t('chat'));
                    self.status = 0;
                }else if(signal == 'timeout'){
                    var nick = message.getAttribute('nick');

                    $ionicPopup.alert({
                        title:'提示信息',
                        template:'<div class="row request"><div class="col col-33 col-center"><img src="/avatar/' + f_jid + '.png"/></div><div class="col col-67"><strong>' + nick + '</strong> 给您发起了视频请求，由于等待时间较长，请求已中断</div></div>',
                        okText:'确认'
                    }).then(function(){
                        if(self.popup) self.popup.close();//关闭之前的

                        con.send($pres().c('show').t('chat'));
                        self.status = 0;
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
        loadVideo:function(elm){
            var self = this,elm = elm || _$('face');
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
            navigator.getUserMedia({video:true,audio:false}, function(stream){
                var video = elm;
                $ionicTip.hide();
                window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
                video.src = window.URL.createObjectURL(stream);
                self.stream = stream;
            },function(error){});
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
                    $ionicLoading.show({template:'您的头像已上传成功,即将返回上一页'});
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
                template:'<em class="ion-loading-c"></em>&nbsp;&nbsp;正在保存您的资料'
            });
        },
        reset:function(){
            var video = document.getElementById('face'),take = document.getElementById('take'),choose = document.getElementById('choose');
            choose.className = 'hidden';
            take.className = '';
            video.play();
        },
        initRTC:function(opts){
            var roomid = opts.roomid,vid,self = this;
            var con = $ionicXmpp.connection,m_jid = $rootScope.userInfo.username;
            var webrtc = $ionicXmpp.webrtc;

            if(!webrtc){
                webrtc = ($ionicXmpp.webrtc =  new SimpleWebRTC({
                    url:'https://www.facehu.com:8888',
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
                    //离开
                    if(!isEnder){//如果不是自己结束聊天
                        $ionicTip.show('对方结束了聊天,请点击左上角结束 ...').timeout(5000);
                        isEnder = true;
                    }else{
                        con.send($pres().c('show').t('chat'));
                        $ionicXmpp.status = 0;
                    }

                    if(vid){//记录结束时间，并结算
                        $http.get('/api/pay/chatRecord/end/' + vid);
                        $http.get('/api/pay/chatTransaction/' + vid);
                    }
                })
                webrtc.on('localMediaError',function(err){
                    var name = err.name,jid = roomid.replace(m_jid,'').replace('_','');
                    con.send($msg({type:'chat',to:jid + '@facetalk'}).c('body').t(name));
                    if(name == 'PermissionDeniedError'){
                        $ionicTip.show('由于您没有开启摄像装置，将无法与对方进行聊天 ...').timeout(5000);
                    }

                    con.send($pres().c('show').t('chat'));
                    $ionicXmpp.status = 0;
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
