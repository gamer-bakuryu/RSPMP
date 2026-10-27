/*  ============================================
    CONNECTION MODULE
    Pure WebRTC with manual signaling via
    copy-paste codes (base64 encoded SDP).
    No external servers needed.
    ============================================ */

const Connection = (() => {
    let peerConnection = null;
    let dataChannel = null;
    let onMessageCallback = null;
    let onOpenCallback = null;
    let onCloseCallback = null;
    let isHost = false;
    let pollInterval = null;
    let roomId = null;

    // ICE servers (public free STUN)
    const ICE_SERVERS = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    };

    // ---- ENCODE/DECODE for signaling via localStorage ----
    function encode(obj) {
        return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    }

    function decode(str) {
        try {
            return JSON.parse(decodeURIComponent(escape(atob(str))));
        } catch (e) {
            return null;
        }
    }

    function generateRoomId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // ---- SETUP PEER CONNECTION ----
    function setupPeerConnection() {
        peerConnection = new RTCPeerConnection(ICE_SERVERS);

        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                if (onCloseCallback) onCloseCallback();
            }
        };
    }

    function setupDataChannel(channel) {
        dataChannel = channel;

        dataChannel.onopen = () => {
            // Clean up signaling data
            clearSignalingData();
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            if (onOpenCallback) onOpenCallback();
        };

        dataChannel.onclose = () => {
            if (onCloseCallback) onCloseCallback();
        };

        dataChannel.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (onMessageCallback) onMessageCallback(data);
        };
    }

    // ---- SIGNALING VIA LOCALSTORAGE (same browser tabs) ----
    // For cross-device, user must copy/paste codes manually.
    // We use localStorage as a simple "signaling server" for same-origin.

    function clearSignalingData() {
        if (roomId) {
            localStorage.removeItem('rspmp_room_' + roomId + '_offer');
            localStorage.removeItem('rspmp_room_' + roomId + '_answer');
            localStorage.removeItem('rspmp_room_' + roomId + '_host_candidates');
            localStorage.removeItem('rspmp_room_' + roomId + '_guest_candidates');
        }
    }

    // ---- HOST ----
    async function host() {
        isHost = true;
        roomId = generateRoomId();

        setupPeerConnection();

        const channel = peerConnection.createDataChannel('game', {
            ordered: true
        });
        setupDataChannel(channel);

        let hostCandidates = [];
        let candidatesComplete = false;

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                hostCandidates.push(event.candidate);
            } else {
                candidatesComplete = true;
                // Store offer + candidates
                const offerData = {
                    sdp: peerConnection.localDescription,
                    candidates: hostCandidates
                };
                localStorage.setItem('rspmp_room_' + roomId + '_offer', encode(offerData));
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // If candidates gathered synchronously (unlikely), store immediately
        setTimeout(() => {
            if (candidatesComplete) return;
            const offerData = {
                sdp: peerConnection.localDescription,
                candidates: hostCandidates
            };
            localStorage.setItem('rspmp_room_' + roomId + '_offer', encode(offerData));
        }, 2000);

        // Poll for answer
        pollInterval = setInterval(async () => {
            const answerRaw = localStorage.getItem('rspmp_room_' + roomId + '_answer');
            if (answerRaw) {
                const answerData = decode(answerRaw);
                if (answerData) {
                    clearInterval(pollInterval);
                    pollInterval = null;

                    await peerConnection.setRemoteDescription(answerData.sdp);
                    for (const candidate of answerData.candidates) {
                        await peerConnection.addIceCandidate(candidate);
                    }
                }
            }
        }, 500);

        return roomId;
    }

    // ---- JOIN ----
    async function join(code) {
        isHost = false;
        roomId = code.toUpperCase().trim();

        const offerRaw = localStorage.getItem('rspmp_room_' + roomId + '_offer');
        if (!offerRaw) {
            throw new Error('Sala não encontrada. Verifique o código.');
        }

        const offerData = decode(offerRaw);
        if (!offerData) {
            throw new Error('Dados da sala corrompidos.');
        }

        setupPeerConnection();

        peerConnection.ondatachannel = (event) => {
            setupDataChannel(event.channel);
        };

        let guestCandidates = [];

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                guestCandidates.push(event.candidate);
            } else {
                const answerData = {
                    sdp: peerConnection.localDescription,
                    candidates: guestCandidates
                };
                localStorage.setItem('rspmp_room_' + roomId + '_answer', encode(answerData));
            }
        };

        await peerConnection.setRemoteDescription(offerData.sdp);
        for (const candidate of offerData.candidates) {
            await peerConnection.addIceCandidate(candidate);
        }

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Fallback store after timeout
        setTimeout(() => {
            const answerData = {
                sdp: peerConnection.localDescription,
                candidates: guestCandidates
            };
            localStorage.setItem('rspmp_room_' + roomId + '_answer', encode(answerData));
        }, 2000);
    }

    // ---- SEND MESSAGE ----
    function send(data) {
        if (dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(data));
        }
    }

    // ---- CLOSE ----
    function close() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        clearSignalingData();
    }

    // ---- EVENT HANDLERS ----
    function onMessage(cb) { onMessageCallback = cb; }
    function onOpen(cb) { onOpenCallback = cb; }
    function onClose(cb) { onCloseCallback = cb; }

    function isConnected() {
        return dataChannel && dataChannel.readyState === 'open';
    }

    return {
        host,
        join,
        send,
        close,
        onMessage,
        onOpen,
        onClose,
        isConnected,
        generateRoomId
    };
})();
