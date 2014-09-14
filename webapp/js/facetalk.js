var app = angular.module('facetalk', ['ionic','facetalk.Services','facetalk.Controllers']);

var _$ = function(id){
    return document.getElementById(id);
}

location.hash = '/tab/home';

app.config(function($httpProvider){
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
})

app.filter('gifTime',function(){
    return function(value,para){
        var arr = /([^\/]+)_(\d+)\.gif/.exec(value);
        if(arr){
            return (para == 'jid' ? arr[1] : arr[2]);
        }else{
            return value;
        }
    }
}).filter('escape',function(){
    return function(value){
        return encodeURI(value);
    }
}).filter('unreaded',function(){
    return function(value,jid){
        return value[jid]
    }
})

app.config(function($stateProvider,$urlRouterProvider){
    var random = 1;
    //首页
    $stateProvider.state('index',{
        url:'/index',
        templateUrl:'index.html?' + random
    })

    //TAB
    $stateProvider.state('tabs',{
        url:'/tab',
        templateUrl:'template/tabs.html?' + random,
        resolve:{//只在第一次访问的时候执行，其他时候不调用
            userinfo:function($ionicUser){
                var name = Storage.cookie.get('_fh_username');
                if(name) return $ionicUser.getInfo(name);
            }
        },
        controller:function($rootScope,$scope,$ionicNavBarDelegate,$ionicXmpp,$ionicTip,$ionicVideo){
            $scope.select = function(hash){
                if((!$rootScope.isLogin || !$rootScope.isComplete) && !$ionicVideo.stream){//1.用户未登录;2.未登录或头像不合乎要求
                    if(!$rootScope.isComplete) Storage.cookie.remove('_fh_username');
                    $ionicTip.show('请先登录').timeout();
                    return;
                }else{
                    if($ionicXmpp.status != 0){//如果正在视频
                        $ionicTip.show('请先挂断视频通话再访问本页面').timeout();
                        return;
                    }else if($ionicVideo.stream){
                        if(!$rootScope.isComplete){//如果是首次拍照页 - 更改图片时允许切换tab但是要关闭摄像头
                            $ionicTip.show('请先完成拍照保存再访问本页面').timeout();
                            return;
                        }else{//其他情况下比为脸信页
                            $ionicVideo.stream.stop();
                        }
                    }
                }
                location.hash = hash;
            }
            $scope.back = function(){
                $ionicNavBarDelegate.back();
            }
        }
    })
    
    //HOME页
    $stateProvider.state('tabs.home',{
        url:'/home',
        views:{
            'tab-home':{
                templateUrl:'template/home.html?' + random,
                controller:function($rootScope,$scope,$http,$ionicLoading,$ionicXmpp,$ionicClient,$ionicNotice){
                    var base = 0,offset = 24;
                    $scope.hasMore = true;
                    $scope.askNotice = function(){
                        $ionicNotice.init();//桌面通知
                    }
                    $scope.loadMore = function(){
                        var url = '/api/facesms/getUserListByPage/' + $rootScope.userInfo.username + '/' + base + '/' + offset;
                        $http.get(url).success(function(data){
                            var l = data.length;

                            if(!$scope.users){
                                $scope.users = data;
                            }else{
                                $scope.users = $scope.users.concat(data);
                            }

                            if(l == offset){
                                base += offset;
                                $scope.hasMore = true;
                                $scope.$broadcast('scroll.infiniteScrollComplete');
                            }else{
                                $scope.hasMore = false;
                            }
                        })
                    }

                    if(!$ionicClient.supportVideo){
                        var msg = '';
                        if($ionicClient.isIOS){
                            msg = '脸呼暂不兼容您的苹果手机，请在计算机或安卓系统的手机上使用chrome浏览器访问脸呼获得最佳的用户体验';
                        }else{
                            if($ionicClient.isPC){
                                var link = $ionicClient.isMAC ? 'http://rj.baidu.com/soft/detail/25718.html' : 'http://rj.baidu.com/soft/detail/14744.html';
                                msg = '您的浏览器暂不兼容脸呼，请使用chrome浏览器访问脸呼获得最佳的用户体验,<a class="link" target="_blank" href="' + link + '">点击下载Chrome浏览器</a>';
                            }else{
                                msg = '您的浏览器暂不兼容脸呼，请使用chrome浏览器访问脸呼获得最佳的用户体验';
                            }
                        }
                        $ionicLoading.show({template:msg})
                    }
                }
            }
        }
    }).state('tabs.login',{
        url:'/login',
        views:{
            'tab-home':{
                templateUrl:'template/login.html?' + random
            }
        }
    }).state('tabs.regist',{
        url:'/regist',
        views:{
            'tab-home':{
                templateUrl:'template/regist.html?' + random
            }
        }
    }).state('tabs.takeTip',{//用户拍照前的提示页
        url:'/takeTip',
        views:{
            'tab-home':{
                templateUrl:'template/take-tip.html?' + random,
                controller:function($scope){
                    $scope.takeURL = '#/tab/take';
                }
            }
        }
    }).state('tabs.removeTip',{//图片不合法重新拍照前的提示页
        url:'/removeTip',
        views:{
            'tab-home':{
                templateUrl:'template/remove-tip.html?' + random
            }
        }
    }).state('tabs.take',{
        url:'/take',
        views:{
            'tab-home':{
                templateUrl:'template/take.html?' + random
            }
        }
    }).state('tabs.detail',{
        url:'/detail/:jid',
        views:{
            'tab-home':{
                templateUrl:'template/detail.html?' + random
            }
        }
    }).state('tabs.chat',{
        url:'/chat/:roomid/:nick',
        views:{
            'tab-home':{
                templateUrl:'template/chat.html?' + random
            }
        }
    })

    //脸信页
    $stateProvider.state('tabs.xin',{
        url:'/xin',
        views:{
            'tab-xin':{
                templateUrl:'template/xin.html?' + random
            }
        }
    }).state('tabs.xin-detail',{
        url:'/xin-detail/:jid/:name',
        views:{
            'tab-xin':{
                templateUrl:'template/xin-detail.html?' + random
            }
        }
    })


    //history通话记录页
    $stateProvider.state('tabs.history',{
        url:'/history',
        views:{
            'tab-history':{
                templateUrl:'template/history.html?' + random,
                controller:function($rootScope,$scope,$http,$ionicTip){
                    var info = $rootScope.userInfo,base = 0,offset = 10;
                    $ionicTip.hide();
                    $scope.hasMore = true;
                    $scope.loadMore = function(){
                        $http.get('/api/pay/getChatRecords/' + info.username + '/' + base + '/' + offset).success(function(data){
                            var l = data.length
                            if(l){
                                for(var i = 0; i < l; i++){
                                    var d = data[i],name = d.partnerUserName,type = d.callType,date = d.beginTime;
                                    data[i]['img'] = '/avatar/' + name + '.40.png';
                                    data[i]['type'] = type == 'called' ? '呼入':'呼出';
                                    data[i]['date'] = date;
                                }

                                if(!$scope.items){
                                    $scope.items = data;
                                }else{
                                    $scope.items = $scope.items.concat(data);
                                }

                                if(l == offset){
                                    base += offset;
                                    $scope.hasMore = true;
                                    $scope.$broadcast('scroll.infiniteScrollComplete');
                                }else{
                                    $scope.hasMore = false;
                                }
                                
                            }else{
                                $scope.hasMore = false;
                            }
                        }).error(function(){
                        })
                    }
                }
            }
        }
    }).state('tabs.hDetail',{
        url:'/hDetail/:jid',
        views:{
            'tab-history':{
                templateUrl:'template/detail.html?' + random
            }
        }
    }).state('tabs.hChat',{
        url:'/hChat/:roomid/:nick',
        views:{
            'tab-history':{
                templateUrl:'template/chat.html?' + random
            }
        }
    })


    //setting个人设置页
    $stateProvider.state('tabs.setting',{
        url:'/setting',
        views:{
            'tab-setting':{
                templateUrl:'template/setting.html?' + random,
                controller:function($rootScope,$scope,$http,$state,$ionicXmpp){
                    var info = $rootScope.userInfo;
                    info.img = '/avatar/' + info.username + '.100.png?' + new Date().getTime();
                    $scope.info = info;
                    
                    $scope.logout = function(){
                        Storage.cookie.remove('_fh_username');
                        try{$ionicXmpp.connection.disconnect();}catch(e){}//有时候xmpp会意外中断
                        $ionicXmpp.connection = null;

                        $rootScope.userInfo = null;
                        $rootScope.isLogin = false;
                        $rootScope.isComplete = false;

                        $state.go('tabs.home');
                    }
                }
            }
        }
    }).state('tabs.settingTakeTip',{
        url:'/settingTakeTip',
        views:{
            'tab-setting':{
                templateUrl:'template/take-tip.html?' + random,
                controller:function($scope){
                    $scope.takeURL = '#/tab/settingTake';
                }
            }
        }
    }).state('tabs.settingTake',{
        url:'/settingTake',
        views:{
            'tab-setting':{
                templateUrl:'template/take.html?' + random
            }
        }
    }).state('tabs.about',{
        url:'/about',
        views:{
            'tab-setting':{
                templateUrl:'template/about.html?' + random
            }
        }
    })

    $urlRouterProvider.otherwise('/tab/home');
})
