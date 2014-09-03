var controllersModule = angular.module('facetalk.Controllers',[]);

controllersModule.controller('loginCtrl',function($rootScope,$scope,$ionicUser,$validor,$state,$ionicTip){
    $ionicTip.hide();//如果登录关闭在首页或者切换tab时的所有提示

    $scope.login = function(form,user){
        if(form.$valid){
            $ionicUser.login(user.loginEmail,user.loginPassword,function(){
                if($rootScope.isComplete){
                    $state.go('tabs.home');
                }else{
                    var complete = $rootScope.userInfo.infoCompleteness;
                    if(complete){//图像不合规则,需重新拍照
                        $state.go('tabs.removeTip');
                    }else{//首次设置头像
                        $state.go('tabs.takeTip');
                    }
                }
            })
        }else{
            $validor.login(form);
        }
    }
    $scope.submit = function(event,form,user){
        var keyCode = event.keyCode || event.which;
        if(keyCode == 13) $scope.login(form,user);
    }
}).controller('registCtrl',function($scope,$ionicUser,$state,$validor){
    $scope.pattern = /^[a-zA-Z\d_\u4e00-\u9fa5]{4,18}$/;
    $scope.next = function(form,user){
        if(form.$valid){
            $ionicUser.regist(user.name,user.password,user.email,function(){
                $state.go('tabs.takeTip');
            })
        }else{
            $validor.regist(form);
        }
    }
    $scope.submit = function(event,form,user){
        var keyCode = event.keyCode || event.which;
        if(keyCode == 13) $scope.next(form,user);
    }
}).controller('removeTipCtrl',function($rootScope,$scope){
    var complete = $rootScope.userInfo.infoCompleteness,msg = '';
    if(complete == 2){
        msg = '头像不清晰';
    }else if(complete == 3){
        msg = '头像不完整';
    }else if(complete == 4){
        msg = '非本人头像';
    }else if(complete == 5){
        msg = '头像不雅';
    }

    $scope.removeInfo = msg;
}).controller('takeCtrl',function($rootScope,$scope,$state,$ionicVideo,$ionicNavBarDelegate){
    $ionicVideo.loadVideo();//开启视频

    $scope.taking = function(){
        $ionicVideo.take.call($ionicVideo)
    };
    $scope.choose = function(){
        $ionicVideo.choose.call($ionicVideo,function(){
            if($ionicVideo.stream) $ionicVideo.stream.stop();
            $state.go('tabs.home');
        })
    }
    $scope.reset = $ionicVideo.reset;
    $scope.back = function(){
        if($ionicVideo.stream) $ionicVideo.stream.stop();
        $ionicVideo.stream = null;
        $ionicNavBarDelegate.back();
    }
}).controller('detailCtrl',function($rootScope,$scope,$stateParams,$http,$state,$ionicTip,$ionicXmpp){
    var from_jid = $rootScope.userInfo.username,jid = ($scope.username = $stateParams.jid),from_nick = $rootScope.userInfo.name;
    //判断当前用户是不是自己
    if(jid == from_jid){
        $scope.myself = true;
        $scope.status = '自己'
        return;
    }else{
        //判断当前用户是否在线
        $http.get('/xmpp/user/status/' + jid + '@facetalk/xml').success(function(data){
            if(/chat/.test(data)){
                $scope.status = '空闲';
                $scope.canChat = true;
            }else if(/dnd/.test(data)){
                $scope.status = '通话中';
            }else if(/(?:error|unavailable)/.test(data)){
                $scope.status = '离线';
            }
        })
        $http.get('/api/user/get/' + jid).success(function(data){//获取用户信息
            $scope.info = data;
        }).error(function(){})
    }

    $scope.xin = function(){
        $state.go('tabs.xin-detail',{jid:jid,name:encodeURI($scope.info.name)})
    }
    $scope.chat = function(){
        var from = {jid:from_jid,nick:from_nick},to = {jid:jid,nick:$scope.info.name};
        $ionicXmpp.sendSignal('video',from,to);

        $ionicTip.show('正在发送视频请求，请勿刷新页面 ...','false').timeout(30000,function(){
            $ionicXmpp.sendSignal('timeout',from,to);
        });
    }
}).controller('chatCtrl',function($scope,$stateParams,$ionicPopup,$ionicVideo,$ionicTip,$ionicXmpp,$state){
    $ionicTip.hide();//终止视频请求时等待的超时请求

    $ionicVideo.initRTC($stateParams);

    $ionicTip.show('正在建立视频连接，请勿刷新页面 ...').timeout(30000,function(){//如果30秒后还如法建立连接
        var f_jid = $stateParams.roomid.split('_')[1],nick = $stateParams.nick;
        $ionicTip.hide();
        $ionicPopup.confirm({
            title:'超时通知',
            template:'视频连接超时 ...',
            okText:'给TA留言',
            cancelText:'确定'
        }).then(function(res){
            $ionicXmpp.setStatus(0);
            if(res){
                var webrtc = $ionicXmpp.webrtc
                webrtc.stopLocalVideo();
                webrtc.leaveRoom();

                $state.go('tabs.xin-detail',{jid:f_jid,name:nick})
            }else{
                $scope.close();
            }
        })
    });

    $scope.close = function(){
        $ionicXmpp.setStatus(0);
        $ionicTip.hide();
        $ionicVideo.cancelRTC();
    }
}).controller('xinCtrl',function($rootScope,$scope,$ionicStorage){
    var facexin = $ionicStorage.facexin;
    if(!facexin) $ionicStorage.init();
    var notices = $ionicStorage.facexin.notices,xins = $ionicStorage.facexin.xins;

    $rootScope.badgeCounts = 0;//进入脸信新消息页,badge消失，未读消息和新消息不是一码事

    angular.forEach(notices,function(notice){
        var jid = notice['jid'];
        notice['unreaded'] = xins[jid].unreaded;
    })
    $scope.notices = notices;

    $scope.$on('news',function(event,message){
        var jid = message.jid;
        $scope.notices[0]['unreaded'] = xins[jid]['unreaded'];
    })
}).controller('xinDetailCtrl',function($rootScope,$scope,$http,$stateParams,$ionicStorage,$ionicVideo,$ionicTip,$ionicRecord,$ionicXmpp,$ionicNavBarDelegate,$ionicScrollDelegate,$timeout){
    var my_jid = $rootScope.userInfo.username,jid = $stateParams.jid,nick = $rootScope.userInfo.name;

    $ionicVideo.loadVideo(_$('facexin'),'请按照浏览器提示，允许使用摄像头',function(){//打开摄像头
        $ionicTip.hide();
    });

    var facexin = $ionicStorage.facexin;
    if(!facexin) $ionicStorage.init();
    var xins = $ionicStorage.facexin.xins;
    xins[jid] = xins[jid] || {};

    $scope.lists = (xins[jid].lists || []).slice(0);
    $scope.name = decodeURI($stateParams.name);

    if(xins[jid]['unreaded']){
        xins[jid]['unreaded'] = 0;
        Storage.set('facexin',$ionicStorage.facexin);
    }

    $scope.$on('news',function(event,message){
        //当我和A聊天时，B也会给我发消息,这个页面只处理正在和谁聊天
        if(message.jid != jid) return;
        $scope.lists.push(message);
        $rootScope.badgeCounts -= 1;
        xins[jid]['unreaded'] = 0;
        Storage.set('facexin',$ionicStorage.facexin);

        $timeout(function(){
            $ionicScrollDelegate.scrollBottom();
        },500)
    })
    //处理图像
    var input = angular.element(_$('chatBar')).find('input');
    input.on('keydown',function(e){
        var keyCode = e.keyCode || e.which;
        if(keyCode == 13){
            if(input.val().length > 50){
                $ionicTip.show('最多允许输入50个字符').timeout();
            }else{
                var v = input.val();
                input.val('消息发送中，请稍后 ...');
                input.attr('disabled','disabled');

                $ionicRecord.showTimer(_$('facexin').parentNode,2);

                $ionicRecord.run({video:_$('facexin')},function(data){
                    var time = new Date().getTime(),gifId = my_jid + '_' + time;
                    var para = 'picData=' + encodeURIComponent(data) + '&gifId=' + gifId;

                    $http.post('/api/facesms/saveGif',para).success(function(data){
                        var status = data.status;
                        if(status == 'success'){
                            $ionicXmpp.connection.send($msg({type:'chat',to:jid + '@facetalk',gifid:gifId,nick:nick}).c('body').t(v))

                            var message = {'jid':jid,'name':$scope.name,'url':'/faceSmsGif/' + gifId.substring(0,2) + '/' + gifId.substring(2,4) + '/' + gifId  + '.gif','text':v};//对方的jid和name
                            $ionicStorage.set(message,true);
                            $scope.lists.push(message);
                            $timeout(function(){
                                $ionicScrollDelegate.scrollBottom();
                            },500)

                            input.removeAttr('disabled');
                            input.val('');
                            input[0].focus();
                        }
                    })
                })
            }
        }
    })

    $scope.back = function(){
        $ionicVideo.stream.stop();
        $ionicVideo.stream = null;
        $ionicNavBarDelegate.back();
    }
})
