(function() {
  /** @type {SocketIOClient.Socket} */
  const socket = io.connect(window.location.origin);
  const localVideo = document.querySelector('.localVideo');
  const remoteVideos = document.querySelector('.remoteVideos');
  const peerConnections = {};
  let room = !location.pathname.substring(1) ? 'home' : location.pathname.substring(1);
  let getUserMediaAttempts = 5;
  let gettingUserMedia = false;
  let sendChannel;
  let receiveChannel;
  const dataChannelSend = document.querySelector('textarea#dataChannelSend');
  dataChannelSend.placeholder = '';
  const dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
  const sendButton = document.querySelector('button#sendButton');

  sendButton.onclick = sendData;

  /** @type {RTCConfiguration} */
  const config = {
    'iceServers': [{
      'urls': ['stun:stun.l.google.com:19302']
    },{
      urls: 'turn:diffusion-video.ddns.net:3478',
      username: '1605984350',
      credential: 'MHWxppa2tYDesawvP4E336reV6M='
    }]
  };

  /** @type {MediaStreamConstraints} */
  const constraints = {
    audio: true,
    video: { facingMode: "user" },
  };

  socket.on('full', function(room) {
    alert('Room ' + room + ' is full');
  });

  socket.on('bye', function(id) {
    handleRemoteHangup(id);
  });

  if (room && !!room) {
    socket.emit('join', room);
  }

  window.onunload = window.onbeforeunload = function() {
    socket.close();
  };

  function sendData() {
    console.log("send channel is ", sendChannel.readyState);
    const data = dataChannelSend.value;
    sendChannel.send(data);
    dataChannelReceive.value += data + "\n";
    dataChannelSend.value = '';
    dataChannelSend.focus();
  }

  socket.on('ready', function (id) {
    if (!(localVideo instanceof HTMLVideoElement) || !localVideo.srcObject) {
      return;
    }
    const peerConnection = new RTCPeerConnection(config);
    peerConnections[id] = peerConnection;
    if (localVideo instanceof HTMLVideoElement) {
      localVideo.srcObject.getTracks().forEach(function (track) {
        peerConnection.addTrack(track, localVideo.srcObject);
        sendChannel = peerConnection.createDataChannel('sendDataChannel');
      });
    }
    peerConnection.createOffer()
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(function () {
      socket.emit('offer', id, peerConnection.localDescription);
    });
    peerConnection.onaddstream = event => handleRemoteStreamAdded(event.stream, id);
    peerConnection.ondatachannel = handleSendChannel;
    peerConnection.onicecandidate = function(event) {
      if (event.candidate) {
        socket.emit('candidate', id, event.candidate);
      }
    };
  });

  socket.on('offer', function(id, description) {
    const peerConnection = new RTCPeerConnection(config);
    peerConnections[id] = peerConnection;
    if (localVideo instanceof HTMLVideoElement) {
      localVideo.srcObject.getTracks().forEach(function (track) {
        peerConnection.addTrack(track, localVideo.srcObject);
      });
    }
    peerConnection.setRemoteDescription(description)
    .then(() => peerConnection.createAnswer())
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(function () {
      socket.emit('answer', id, peerConnection.localDescription);
    });
    peerConnection.onaddstream = event => handleRemoteStreamAdded(event.stream, id);
    peerConnection.ondatachannel = handleRemoteData;
    peerConnection.onicecandidate = function(event) {
      if (event.candidate) {
        socket.emit('candidate', id, event.candidate);
      }
    };
  });

  socket.on('candidate', function(id, candidate) {
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate))
    .catch(e => console.error(e));
  });

  socket.on('answer', function(id, description) {
    peerConnections[id].setRemoteDescription(description);
  });

  function getUserMediaSuccess(stream) {
    gettingUserMedia = false;
    if (localVideo instanceof HTMLVideoElement) {
      !localVideo.srcObject && (localVideo.srcObject = stream);
    }
    socket.emit('ready');
  }

  function handleRemoteStreamAdded(stream, id) {
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = stream;
    remoteVideo.setAttribute("id", id.replace(/[^a-zA-Z]+/g, "").toLowerCase());
    remoteVideo.setAttribute("playsinline", "true");
    remoteVideo.setAttribute("autoplay", "true");
    remoteVideos.appendChild(remoteVideo);
    if (remoteVideos.querySelectorAll("video").length === 1) {
      remoteVideos.setAttribute("class", "one remoteVideos");
    } else {
      remoteVideos.setAttribute("class", "remoteVideos");
    }
  }

  function handleRemoteData(event) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = handleReceiveChannelStatusChange;
    receiveChannel.onclose = handleReceiveChannelStatusChange;
  }

  function handleReceiveChannelStatusChange(event) {
    if (receiveChannel) {
      console.log("Receive channel's status has changed to " + receiveChannel.readyState);
    }
  }

  function handleSendChannel(event) {
    if (sendChannel) {
      let state = sendChannel.readyState;
    }
  }

  function onReceiveMessageCallback(event) {
    dataChannelReceive.value += event.data + '\n';
  }

  function getUserMediaError(error) {
    console.error(error);
    gettingUserMedia = false;
    (--getUserMediaAttempts > 0) && setTimeout(getUserMediaDevices, 1000);
  }

  function getUserMediaDevices() {
    if (localVideo instanceof HTMLVideoElement) {
      if (localVideo.srcObject) {
        getUserMediaSuccess(localVideo.srcObject);
      } else if (!gettingUserMedia && !localVideo.srcObject) {
        gettingUserMedia = true;
        navigator.mediaDevices.getUserMedia(constraints)
        .then(getUserMediaSuccess)
        .catch(getUserMediaError);
      }
    }
  }

  function handleRemoteHangup(id) {
    sendChannel.close();
    receiveChannel.close();
    peerConnections[id] && peerConnections[id].close();
    delete peerConnections[id];
    document.querySelector("#" + id.replace(/[^a-zA-Z]+/g, "").toLowerCase()).remove();
    if (remoteVideos.querySelectorAll("video").length === 1) {
      remoteVideos.setAttribute("class", "one remoteVideos");
    } else {
      remoteVideos.setAttribute("class", "remoteVideos");
    }
  }

  getUserMediaDevices();
})();