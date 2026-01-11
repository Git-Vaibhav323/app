import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { PermissionsAndroid, Platform } from 'react-native';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

export type VideoCallCallbacks = {
  onStateChange?: (state: CallState) => void;
  onLocalStream?: (stream: any) => void;
  onRemoteStream?: (stream: any) => void;
  onError?: (message: string) => void;
  onPartnerLeft?: () => void;
};

const getEngageBaseUrl = (): string => {
  const expoExtraValue = Constants.expoConfig?.extra?.['EXPO_PUBLIC_BACKEND_URL'];
  if (expoExtraValue && typeof expoExtraValue === 'string' && expoExtraValue.trim() !== '') {
    let url = expoExtraValue.trim();
    if (url.includes(':3001')) {
      url = url.replace(':3001', ':3002');
    } else if (url.includes(':8001')) {
      url = url.replace(':8001', ':3002');
    }
    return url;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3002';
  }

  return 'http://localhost:3002';
};

const loadWebRTC = (): any | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-webrtc');
  } catch {
    return null;
  }
};

class VideoCallService {
  private socket: Socket | null = null;
  private pc: any | null = null;
  private localStream: any | null = null;
  private remoteStream: any | null = null;
  private roomId: string | null = null;
  private selfId: string | null = null;
  private partnerId: string | null = null;
  private isCaller: boolean = false;
  private state: CallState = 'idle';

  private setState(next: CallState, cb?: VideoCallCallbacks) {
    this.state = next;
    cb?.onStateChange?.(next);
  }

  private ensureWebRTC(cb?: VideoCallCallbacks): any {
    const WebRTC = loadWebRTC();
    if (!WebRTC) {
      cb?.onError?.('react-native-webrtc is not installed/configured. Build a dev client with WebRTC support.');
      throw new Error('react-native-webrtc not available');
    }
    return WebRTC;
  }

  async start(params: {
    roomId: string;
    selfId: string;
    partnerId: string;
    callbacks?: VideoCallCallbacks;
  }): Promise<void> {
    const { roomId, selfId, partnerId, callbacks } = params;

    this.roomId = roomId;
    this.selfId = selfId;
    this.partnerId = partnerId;
    this.isCaller = selfId.localeCompare(partnerId) < 0;

    this.setState('connecting', callbacks);

    const WebRTC = this.ensureWebRTC(callbacks);

    const namespaceUrl = `${getEngageBaseUrl()}/video-call`;
    this.socket = io(namespaceUrl, {
      transports: ['websocket'],
      upgrade: false,
      timeout: 20000,
      auth: {
        userId: selfId,
      },
      forceNew: true,
      autoConnect: true,
    });

    this.socket.on('connect_error', (err: any) => {
      callbacks?.onError?.(err?.message || 'Failed to connect to video signaling server');
      this.setState('error', callbacks);
    });

    this.socket.on('error', (err: any) => {
      callbacks?.onError?.(err?.message || 'Video signaling error');
    });

    this.socket.on('participant_left', () => {
      callbacks?.onPartnerLeft?.();
    });

    this.socket.on('webrtc_hangup', () => {
      callbacks?.onPartnerLeft?.();
    });

    this.socket.on('room_ready', async () => {
      if (this.isCaller) {
        try {
          await this.createAndSendOffer(callbacks);
        } catch (e: any) {
          callbacks?.onError?.(e?.message || 'Failed to create offer');
        }
      }
    });

    this.socket.on('webrtc_offer', async ({ sdp }: any) => {
      try {
        await this.handleOffer(sdp, callbacks);
      } catch (e: any) {
        callbacks?.onError?.(e?.message || 'Failed to handle offer');
      }
    });

    this.socket.on('webrtc_answer', async ({ sdp }: any) => {
      try {
        await this.handleAnswer(sdp, callbacks);
      } catch (e: any) {
        callbacks?.onError?.(e?.message || 'Failed to handle answer');
      }
    });

    this.socket.on('webrtc_ice_candidate', async ({ candidate }: any) => {
      try {
        if (candidate && this.pc) {
          await this.pc.addIceCandidate(new WebRTC.RTCIceCandidate(candidate));
        }
      } catch {
        // ignore
      }
    });

    await this.startLocalMedia(callbacks);
    this.createPeerConnection(callbacks);

    this.socket.emit('join_room', { roomId });
  }

  private async startLocalMedia(callbacks?: VideoCallCallbacks): Promise<void> {
    const WebRTC = this.ensureWebRTC(callbacks);

    if (Platform.OS === 'android') {
      try {
        const camera = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        const mic = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

        if (camera !== PermissionsAndroid.RESULTS.GRANTED || mic !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Camera/Microphone permission denied');
        }
      } catch (e: any) {
        callbacks?.onError?.(e?.message || 'Failed to request camera/microphone permissions');
        throw e;
      }
    }

    const constraints = {
      audio: true,
      video: {
        facingMode: 'user',
        width: 640,
        height: 480,
        frameRate: 30,
      },
    } as any;

    this.localStream = await WebRTC.mediaDevices.getUserMedia(constraints);
    callbacks?.onLocalStream?.(this.localStream);
  }

  private createPeerConnection(callbacks?: VideoCallCallbacks) {
    if (!this.roomId) return;

    const WebRTC = this.ensureWebRTC(callbacks);

    const pc = new WebRTC.RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.pc = pc;

    if (this.localStream) {
      const tracks = this.localStream.getTracks?.() || [];
      tracks.forEach((track: any) => {
        try {
          pc.addTrack(track, this.localStream);
        } catch {
          // ignore
        }
      });
    }

    pc.onicecandidate = (event: any) => {
      if (!event?.candidate || !this.socket || !this.roomId) return;
      this.socket.emit('webrtc_ice_candidate', {
        roomId: this.roomId,
        candidate: event.candidate,
      });
    };

    pc.ontrack = (event: any) => {
      const stream = event?.streams?.[0];
      if (!stream) return;
      this.remoteStream = stream;
      callbacks?.onRemoteStream?.(stream);
      this.setState('connected', callbacks);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed' || state === 'disconnected') {
        callbacks?.onPartnerLeft?.();
      }
    };
  }

  private async createAndSendOffer(callbacks?: VideoCallCallbacks) {
    if (!this.socket || !this.pc || !this.roomId) return;

    const WebRTC = this.ensureWebRTC(callbacks);

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.pc.setLocalDescription(offer);

    this.socket.emit('webrtc_offer', {
      roomId: this.roomId,
      sdp: new WebRTC.RTCSessionDescription(offer),
    });
  }

  private async handleOffer(sdp: any, callbacks?: VideoCallCallbacks) {
    if (!this.socket || !this.pc || !this.roomId) return;

    const WebRTC = this.ensureWebRTC(callbacks);

    await this.pc.setRemoteDescription(new WebRTC.RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.socket.emit('webrtc_answer', {
      roomId: this.roomId,
      sdp: new WebRTC.RTCSessionDescription(answer),
    });
  }

  private async handleAnswer(sdp: any, callbacks?: VideoCallCallbacks) {
    if (!this.pc) return;

    const WebRTC = this.ensureWebRTC(callbacks);

    await this.pc.setRemoteDescription(new WebRTC.RTCSessionDescription(sdp));
  }

  setMicrophoneEnabled(enabled: boolean) {
    const audioTracks = this.localStream?.getAudioTracks?.() || [];
    audioTracks.forEach((t: any) => {
      t.enabled = enabled;
    });
  }

  setCameraEnabled(enabled: boolean) {
    const videoTracks = this.localStream?.getVideoTracks?.() || [];
    videoTracks.forEach((t: any) => {
      t.enabled = enabled;
    });
  }

  hangup() {
    if (this.socket && this.roomId) {
      this.socket.emit('webrtc_hangup', { roomId: this.roomId });
    }

    try {
      this.pc?.close?.();
    } catch {
      // ignore
    }

    try {
      const tracks = this.localStream?.getTracks?.() || [];
      tracks.forEach((t: any) => t.stop?.());
    } catch {
      // ignore
    }

    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.roomId = null;
    this.partnerId = null;
    this.selfId = null;

    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {
        // ignore
      }
    }

    this.socket = null;
    this.state = 'ended';
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }
}

export default new VideoCallService();
