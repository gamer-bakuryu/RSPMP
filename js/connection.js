/*  ============================================
    CONNECTION MODULE (PeerJS version)
    Uses PeerJS public signaling server (free),
    but all game data flows peer-to-peer directly.
    ============================================ */

const Connection = (() => {
    let peer = null;
    let conn = null;
    let onMessageCallback = null;
    let onOpenCallback = null;
    let onCloseCallback = null;
    let isHost = false;
    let myRoomId = null;

    // Prefix to avoid ID collisions with other apps using PeerJS cloud
    const ID_PREFIX = 'rspmp-';

    function generateRoomId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function setupConnection(connection) {
        conn = connection;

        conn.on('open', () => {
            if (onOpenCallback) onOpenCallback();
        });

        conn.on('data', (data) => {
            if (onMessageCallback) onMessageCallback(data);
        });

        conn.on('close', () => {
            if (onCloseCallback) onCloseCallback();
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            if (onCloseCallback) onCloseCallback();
        });
    }

    // ---- HOST ----
    function host() {
        return new Promise((resolve, reject) => {
            isHost = true;
            myRoomId = generateRoomId();
            const peerId = ID_PREFIX + myRoomId;

            // Destroy any existing peer
            if (peer) {
                try { peer.destroy(); } catch (e) {}
                peer = null;
            }

            peer = new Peer(peerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun.cloudflare.com:3478' }
                    ]
                }
            });

            let resolved = false;

            peer.on('open', (id) => {
                if (resolved) return;
                resolved = true;
                resolve(myRoomId);
            });

            peer.on('connection', (connection) => {
                setupConnection(connection);
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (!resolved) {
                    resolved = true;
                    if (err.type === 'unavailable-id') {
                        // Retry with new ID
                        myRoomId = generateRoomId();
                        host().then(resolve).catch(reject);
                    } else {
                        reject(new Error('Erro ao criar sala: ' + err.type));
                    }
                } else {
                    if (onCloseCallback && (err.type === 'network' || err.type === 'disconnected' || err.type === 'peer-unavailable')) {
                        onCloseCallback();
                    }
                }
            });

            peer.on('disconnected', () => {
                // Try reconnect to signaling (not needed for data)
                try { peer.reconnect(); } catch (e) {}
            });

            // Timeout fallback
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('Tempo esgotado ao criar sala. Tente novamente.'));
                }
            }, 15000);
        });
    }

    // ---- JOIN ----
    function join(code) {
        return new Promise((resolve, reject) => {
            isHost = false;
            myRoomId = code.toUpperCase().trim();
            const hostPeerId = ID_PREFIX + myRoomId;

            // Destroy any existing peer
            if (peer) {
                try { peer.destroy(); } catch (e) {}
                peer = null;
            }

            // Create peer with random ID (guest doesn't need fixed ID)
            peer = new Peer({
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun.cloudflare.com:3478' }
                    ]
                }
            });

            let resolved = false;

            peer.on('open', (id) => {
                // Now try to connect to host
                const connection = peer.connect(hostPeerId, {
                    reliable: true
                });

                connection.on('open', () => {
                    if (resolved) return;
                    resolved = true;
                    setupConnection(connection);
                    resolve();
                });

                connection.on('error', (err) => {
                    if (!resolved) {
                        resolved = true;
                        reject(new Error('Sala não encontrada. Verifique o código.'));
                    }
                });
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (!resolved) {
                    resolved = true;
                    if (err.type === 'peer-unavailable') {
                        reject(new Error('Sala não encontrada. Verifique o código.'));
                    } else if (err.type === 'network' || err.type === 'server-error') {
                        reject(new Error('Erro de rede. Tente novamente.'));
                    } else {
                        reject(new Error('Erro ao conectar: ' + err.type));
                    }
                } else {
                    if (onCloseCallback) onCloseCallback();
                }
            });

            // Timeout fallback
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('Tempo esgotado. Verifique o código e tente novamente.'));
                }
            }, 15000);
        });
    }

    // ---- SEND MESSAGE ----
    function send(data) {
        if (conn && conn.open) {
            conn.send(data);
        }
    }

    // ---- CLOSE ----
    function close() {
        if (conn) {
            try { conn.close(); } catch (e) {}
            conn = null;
        }
        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }
    }

    // ---- EVENT HANDLERS ----
    function onMessage(cb) { onMessageCallback = cb; }
    function onOpen(cb) { onOpenCallback = cb; }
    function onClose(cb) { onCloseCallback = cb; }

    function isConnected() {
        return conn && conn.open;
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
