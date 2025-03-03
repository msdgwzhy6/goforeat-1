import React, { Component } from "react";
import {
  Image,
  View,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ToastAndroid,
} from "react-native";
import {connect} from 'react-redux';
import { Input, Icon, ActionSheet,Footer, Container, Content } from "native-base";
import { LoginButton, AccessToken } from 'react-native-fbsdk';
// import InstagramLogin from 'react-native-instagram-login'
//utils
import GLOBAL_PARAMS, { em } from "./utils/global_params";
import ToastUtil from "./utils/ToastUtil";
import NavigationService from "./utils/NavigationService";
//cache
import { userStorage } from "./cache/appStorage";
//api
import { getCode, checkCode, saveDevices } from "./api/request";
import {abortRequestInPatchWhenRouteChange} from "./api/CancelToken";
//jpush
import JPushModule from "jpush-react-native";
//styles
import LoginStyle from "./styles/login.style";
import CommonStyle from "./styles/common.style";
import ManageCreditCardStyles from "./styles/managecreditcard.style";
//components
import CommonBottomBtn from "./components/CommonBottomBtn";
import Text from "./components/UnScalingText";
import CommonModal from "./components/CommonModal";

const BUTTONS = [
  GLOBAL_PARAMS.phoneType.HK.label,
  GLOBAL_PARAMS.phoneType.CHN.label,
  "Cancel"
];
const DESTRUCTIVE_INDEX = 3;
const CANCEL_INDEX = 2;

class CustomLoginView extends Component {
  _commonModal = null;
  _textInput = null;
  token = null;
  _timer = null;
  _actionSheet = null;
  phone = null;
  password = null;
  instagramLogin = null;
  state = {
    phone: null,
    password: null,
    selectedValue: GLOBAL_PARAMS.phoneType.HK,
    codeContent: this.props.i18n.sendCode,
    isCodeDisabled: false,
    isKeyBoardShow: false,
    loading: false,
    phoneErrorTips: '',
    codeErrorTips: ''
  };

  componentWillUnmount() {
    abortRequestInPatchWhenRouteChange();
    clearInterval(this.interval);
    clearTimeout(this._timer);
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return JSON.stringify(nextState) != JSON.stringify(this.state) || this.props.showLogin != nextProps.showLogin;
  };
  

  //common function

  _keyboardDidShow(e) {
    // this._keyboard_height = e.startCoordinates.height - e.endCoordinates.height;
    this._toggleKeyBoard(1);
  }

  _keyboardDidHide() {
    this._toggleKeyBoard(0);
  }

  _sendPhoneAndGetCode() {
    let { i18n } = this.props;
    if (this.phone === null) {
      this.setState({
        phoneErrorTips: i18n.login_tips.fail.phone_null
      });
      return;
    }
    getCode(this.phone, this.state.selectedValue.value).then(
      data => {
          this.token = data.token;
          ToastUtil.showWithMessage(i18n.login_tips.success.code);
          let _during = 60;
          this.interval = setInterval(() => {
            _during--;
            this.setState({
              codeContent: `${_during}${
                i18n.login_tips.common.resendAfterSceond
              }`,
              isCodeDisabled: true
            });
            if (_during === 0) {
              this.setState({
                codeContent: i18n.login_tips.common.resend,
                isCodeDisabled: false
              });
              clearInterval(this.interval);
            }
          }, 1000);
      });
  }

  _getPhone(phone) {
    if(this.state.phoneErrorTips != '') {
      this.setState({
        phoneErrorTips: ''
      })
    }
    this.phone = phone;
  }

  _getPassword(password) {
    if(this.state.codeErrorTips != '') {
      this.setState({
        codeErrorTips: ''
      })
    }
    this.password = password;
  }

  _toast(message) {
    this._commonModal.showToast(message);
    // Platform.OS == 'ios' ? (alert(message)) : ToastAndroid.show(message, ToastAndroid.SHORT);
  }

  _checkPhoneIsValid() {
    let { i18n } = this.props;
    let _regMainLandChina = /^1(3|4|5|6|7|8|9)\d{9}$/;
    let _regHK = /^1[0-9]{10}$|^[569][0-9]{7}$/;
    if(this.phone === null || this.phone === '') {
      this.setState({
        phoneErrorTips: i18n.login_tips.fail.phone_null
      });
      return false;
    }
    if(!(_regMainLandChina.test(this.phone) || _regHK.test(this.phone))) {
      this.setState({
        phoneErrorTips: i18n.login_tips.fail.phone_format
      });
      return false;
    }
    return true;
  }

  _checkPasswordIsValid() {
    let { i18n } = this.props;
    if(this.password === null || this.password === '') {
      this.setState({
        codeErrorTips: i18n.login_tips.fail.code_null
      });
      return false;
    }
    return true;
  }

  _login() {
    let { i18n } = this.props;
    let { selectedValue, password } = this.state;
    if(!this._checkPhoneIsValid() || !this._checkPasswordIsValid()) {
      return
    }
    this.setState({loading: true});
    checkCode(this.phone, selectedValue.value, this.token, this.password)
      .then(data => {
        this.setState({loading: false});
          ToastUtil.showWithMessage(i18n.login_tips.success.login);
          const { account, sid, nickName, profileImg } = data;
          let _user = {
            username: account,
            sid,
            nickName,
            profileImg
          };
          userStorage.setData(_user);
          this.props.userLogin(_user);
          let _timer = setTimeout(() => {
            let {toPage} = this.props;
            if(toPage.routeName && toPage.routeName == 'UserInfo') {
              NavigationService.navigate('DrawerClose');
            }else {
              NavigationService.navigateWithWholeRouteParmas(toPage);
            }
            // console.log(1111111111111,this.props.toPage);
            clearTimeout(_timer);
          }, 300);
          JPushModule.getRegistrationID(
            registrationId => {
              saveDevices(registrationId, data.sid).then(sdata => {
                this.props.toggleLogin(false);
              }).catch(err => {
                this.props.toggleLogin(false);
              });
            },
            () => {
              ToastUtil.showWithMessage(i18n.login_tips.fail.login);
            }
          );
          this.setState({loading: false});
      })
      .catch(err => {
        console.log(err);
        this.setState({loading: false});
        this._commonModal.showToast(err.errMsg);
      });
  }

  _showActionSheet = () => {
    let { i18n } = this.props;
    if (this._actionSheet !== null) {
      // Call as you would ActionSheet.show(config, callback)
      this._actionSheet._root.showActionSheet(
        {
          options: BUTTONS,
          cancelButtonIndex: CANCEL_INDEX,
          destructiveButtonIndex: DESTRUCTIVE_INDEX,
          title: i18n.login_tips.common.choosePhone
        },
        buttonIndex => {
          switch (BUTTONS[buttonIndex]) {
            case GLOBAL_PARAMS.phoneType.HK.label:
              this.setState({ selectedValue: GLOBAL_PARAMS.phoneType.HK });
              break;
            case GLOBAL_PARAMS.phoneType.CHN.label:
              this.setState({ selectedValue: GLOBAL_PARAMS.phoneType.CHN });
              break;
          }
        }
      );
    }
  }

  //render function

  _renderTopImage() {
    let { navigation } = this.props;
    return (
      <View style={LoginStyle.TopImageView}>
        <Image
          source={require("./asset/login_bg.png")}
          style={LoginStyle.TopImage}
          reasizeMode="cover"
        />
        <View style={LoginStyle.TopImageViewInner}>
          <Image
            source={require("./asset/logoTop.png")}
            style={LoginStyle.TopImageViewTitle}
          />
        </View>
        {/* <TouchableOpacity
          style={LoginStyle.CloseBtn}
          onPress={() => this.props.toggleLogin(false)}
        >
          <Icon name="ios-arrow-back" style={LoginStyle.CloseImage} />
        </TouchableOpacity> */}
      </View>
    );
  }

  _renderContentView() {
    let { i18n } = this.props;
    const { loading, phoneErrorTips, codeErrorTips } = this.state;
    return (
      <View style={LoginStyle.ContentView}>
        <Text style={LoginStyle.Title}>{i18n.signInPhone}</Text>
        <View style={LoginStyle.CommonView}>
          <View style={[LoginStyle.CommonInputView,{borderBottomColor: phoneErrorTips == '' ? '#EBEBEB' : '#ff5050'}]}>
            <Image
              source={require("./asset/phone.png")}
              style={LoginStyle.phone}
              reasizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => this._showActionSheet()}
              style={LoginStyle.ChangePhoneTypeBtn}
            >
              <Text style={LoginStyle.PhoneTypeText}>
                {this.state.selectedValue.label}
              </Text>
              <Image
                reasizeMode="cover"
                source={require("./asset/arrowdown.png")}
                style={LoginStyle.ArrowDown}
              />
            </TouchableOpacity>
            <Input
              ref={t => (this._textInput = t)}
              allowFontScaling={false}
              onChangeText={phone => this._getPhone(phone)}
              style={LoginStyle.CommonInput}
              multiline={false}
              autoFocus={false}
              placeholder={i18n.fillInPhone}
              keyboardType="numeric"
              clearButtonMode="while-editing"
              placeholderTextColor="#999999"
              maxLength={11}
              returnKeyType="done"
            />
            {
              phoneErrorTips != null ? <Text style={LoginStyle.loginErrorTips}>{phoneErrorTips}</Text> : null
            }
            
          </View>
          <View style={[LoginStyle.CommonInputView, {borderBottomColor: codeErrorTips == '' ? '#EBEBEB' : '#ff5050'}]}>
            <Image
              source={require("./asset/password.png")}
              style={LoginStyle.password}
              reasizeMode="cover"
            />
            <Input
              onChangeText={password => this._getPassword(password)}
              style={LoginStyle.CommonInput}
              allowFontScaling={false}
              multiline={false}
              autoFocus={false}
              placeholder={i18n.fillInCode}
              clearButtonMode="while-editing"
              placeholderTextColor="#999999"
              returnKeyType="done"
              keyboardType="numeric"
              maxLength={6}
            />
            {
              codeErrorTips != "" ? <Text style={LoginStyle.loginErrorTips}>{codeErrorTips}</Text> : null
            }
            <TouchableOpacity
              style={[
                LoginStyle.SendBtn,
                {
                  borderColor: this.state.isCodeDisabled ? "#ff4141" : "#999999"
                }
              ]}
              disabled={this.state.isCodeDisabled}
              onPress={() => this._sendPhoneAndGetCode()}
            >
              <Text
                style={[
                  LoginStyle.SendText,
                  { color: this.state.isCodeDisabled ? "#ff4141" : "#999999" }
                ]}
              >
                {this.state.codeContent}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <CommonBottomBtn clickFunc={() => this._login()} loading={loading}>
          {i18n.loginOrRegister}
        </CommonBottomBtn>
        {/* {this._renderFbLoginView()} */}
      </View>
    );
  }

  _renderDividerView() {
    return (
      <View style={CommonStyle.DividerView}>
        <View style={CommonStyle.Divider} />
        <Text style={CommonStyle.DividerText}>或</Text>
        <View style={CommonStyle.Divider} />
      </View>
    );
  }

  _renderBottomView() {
    return (
      <View style={CommonStyle.BottomView}>
        {this._renderDividerView()}
        <View style={CommonStyle.BottomViewInner}>
          <Image
            source={require("./asset/facebook2.png")}
            style={CommonStyle.BottomViewInnerImage}
          />
          <Image
            source={require("./asset/wechat.png")}
            style={CommonStyle.BottomViewInnerImage}
          />
        </View>
      </View>
    );
  }

  _renderFbLoginView() {
    return (
      <View style={{alignItems: 'center'}}>
        <LoginButton
            onLoginFinished={
              (error, result) => {
                if (error) {
                  console.log("login has error: " + result.error);
                } else if (result.isCancelled) {
                  console.log("login is cancelled.");
                } else {
                  AccessToken.getCurrentAccessToken().then(
                    (data) => {
                      alert(data.accessToken.toString())
                    }
                  )
                }
              }
          }
        onLogoutFinished={() => console.log("logout.")}/>
      </View>
    )
  }

  // _renderInstagramLoginView() {
  //   return (
  //     <View>
  //       <TouchableOpacity onPress={()=> this.instagramLogin.show()}>
  //         <Text>Login</Text>
  //       </TouchableOpacity>
  //       <InstagramLogin
  //           ref= {ref => this.instagramLogin= ref}
  //           clientId='xxxxxxxxxx'
  //           redirectUrl='yourRedirectUrl'
  //           scopes={['public_content', 'follower_list']}
  //           onLoginSuccess={(token) => this.setState({ token })}
  //           onLoginFailure={(data) => console.log(data)}
  //       />
  //     </View>
  //   )
  // }

  render() {
    return (
      <CommonModal
        ref={r => this._commonModal = r}
        isHeaderShow={false}
        type="login"
        modalVisible={this.props.showLogin}
        closeFunc={() => this.props.toggleLogin(false)}  
        animationType={Platform.OS == 'ios' ? 'slide' : 'fade'}
      >
        <Container>
          <Content bounces={false}>
            <KeyboardAvoidingView
              style={[
                LoginStyle.LoginContainer
              ]}
            >
              {this._renderTopImage()}
              {this._renderContentView()}
              
              {/*this._renderBottomView()*/}
              <ActionSheet
                ref={a => {
                  this._actionSheet = a;
                }}
              />
            </KeyboardAvoidingView>
          </Content>
          <Footer style={{borderTopWidth: 0,backgroundColor: '#fff'}}>
            <TouchableOpacity
              style={[ManageCreditCardStyles.FooterBtn, {borderTopWidth: 0,}]}
              onPress={() => this.props.toggleLogin(false)}
            >
              {/* <Text style={ManageCreditCardStyles.BottomInfo}>
                暫不登錄
              </Text> */}
              <Image style={{width: em(30), height: em(30)}} source={require('./asset/close3.png')} resizeMode="contain"/>
            </TouchableOpacity>
          </Footer>
        </Container>
      </CommonModal>
    );
  }
}

const stateToLogin = state => ({
  toPage: state.login.toPage,
})


const propsToLogin = dispatch => ({
  toggleLogin: (status) => dispatch({type:'CHANGE_LOGIN_STATUS', showLogin: status}),
  userLogin: (user) => dispatch({type:"LOGIN",...user}),
})

export default connect(stateToLogin, propsToLogin)(CustomLoginView);