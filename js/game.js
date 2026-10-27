const Connection = (() => {
    let peer = null;
    let conn = null;
    let onMessageCallback = null;
    let onOpenCallback = null;
    let onCloseCallback = null;
    let isHost = false;
    let myRoomId = null;
    let hostReady = false;
    let destroyed = false;

    const ID_PREFIX = 'rspmp-game-';

    function generateRoomId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function cleanUp() {
        if (conn) {
            try { conn.close(); } catch (e) {}
            conn = null;
        }
        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }
        hostReady = false;
        destroyed = true;
    }

    function setupConn(c) {
        conn = c;

        conn.on('open', () => {
            console.log('[CONN] Data channel open');
            if (onOpenCallback) onOpenCallback();
        });

        conn.on('data', (data) => {
            console.log('[CONN] Received:', data);
            if (onMessageCallback) onMessageCallback(data);
        });

        conn.on('close', () => {
            console.log('[CONN] Connection closed');
            if (onCloseCallback) onCloseCallback();
        });

        conn.on('error', (err) => {
            console.error('[CONN] Error:', err);
            if (onCloseCallback) onCloseCallback();
        });
    }

    function host(onStatusUpdate) {
        return new Promise((resolve, reject) => {
            destroyed = false;
            isHost = true;
            myRoomId = generateRoomId();
            const peerId = ID_PREFIX + myRoomId;

            if (peer) {
                try { peer.destroy(); } catch (e) {}
                peer = null;
            }

            if (onStatusUpdate) onStatusUpdate('Conectando ao servidor...');

            peer = new Peer(peerId);

            let resolved = false;

            peer.on('open', (id) => {
                console.log('[HOST] Peer registered with ID:', id);
                hostReady = true;
                if (!resolved) {
                    resolved = true;
                    if (onStatusUpdate) onStatusUpdate('Aguardando oponente...');
                    resolve(myRoomId);
                }
            });

            peer.on('connection', (incomingConn) => {
                console.log('[HOST] Incoming connection from:', incomingConn.peer);
                setupConn(incomingConn);
            });

            peer.on('error', (err) => {
                console.error('[HOST] Peer error:', err.type, err);
                if (!resolved) {
                    resolved = true;
                    if (err.type === 'unavailable-id') {
                        myRoomId = generateRoomId();
                        const newPeerId = ID_PREFIX + myRoomId;
                        if (peer) { try { peer.destroy(); } catch(e){} }
                        peer = new Peer(newPeerId);
                        peer.on('open', (id2) => {
                            hostReady = true;
                            if (onStatusUpdate) onStatusUpdate('Aguardando oponente...');
                            resolve(myRoomId);
                        });
                        peer.on('connection', (ic) => { setupConn(ic); });
                        peer.on('error', (e2) => {
                            reject(new Error('Erro ao criar sala. Tente novamente.'));
                        });
                    } else {
                        reject(new Error('Erro: ' + err.type + '. Tente novamente.'));
                    }
                }
            });

            peer.on('disconnected', () => {
                console.log('[HOST] Disconnected from signaling');
                if (!destroyed && peer) {
                    try { peer.reconnect(); } catch (e) {}
                }
            });

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('Tempo esgotado. Verifique sua conexão e tente novamente.'));
                }
            }, 20000);
        });
    }

    function join(code, onStatusUpdate) {
        return new Promise((resolve, reject) => {
            destroyed = false;
            isHost = false;
            myRoomId = code.toUpperCase().trim();
            const hostPeerId = ID_PREFIX + myRoomId;

            if (peer) {
                try { peer.destroy(); } catch (e) {}
                peer = null;
            }

            if (onStatusUpdate) onStatusUpdate('Conectando ao servidor...');

            peer = new Peer();

            let resolved = false;
            let retryCount = 0;
            const maxRetries = 3;

            function attemptConnect() {
                if (resolved || destroyed) return;

                console.log('[JOIN] Attempting connection to:', hostPeerId, '(attempt', retryCount + 1, ')');
                if (onStatusUpdate) onStatusUpdate('Procurando sala... (tentativa ' + (retryCount + 1) + ')');

                const c = peer.connect(hostPeerId, {
                    reliable: true,
                    serialization: 'json'
                });

                let connectTimeout = setTimeout(() => {
                    if (!resolved) {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            console.log('[JOIN] Timeout, retrying...');
                            attemptConnect();
                        } else {
                            resolved = true;
                            reject(new Error('Sala não encontrada. Verifique se o código está correto e se o host está aguardando.'));
                        }
                    }
                }, 8000);

                c.on('open', () => {
                    clearTimeout(connectTimeout);
                    if (!resolved) {
                        resolved = true;
                        console.log('[JOIN] Connected!');
                        setupConn(c);
                        if (onStatusUpdate) onStatusUpdate('Conectado!');
                        resolve();
                    }
                });

                c.on('error', (err) => {
                    clearTimeout(connectTimeout);
                    console.error('[JOIN] Connect error:', err);
                    if (!resolved) {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            setTimeout(attemptConnect, 1500);
                        } else {
                            resolved = true;
                            reject(new Error('Sala não encontrada. Verifique o código.'));
                        }
                    }
                });
            }

            peer.on('open', (id) => {
                console.log('[JOIN] My peer ID:', id);
                attemptConnect();
            });

            peer.on('error', (err) => {
                console.error('[JOIN] Peer error:', err.type, err);
                if (!resolved) {
                    if (err.type === 'peer-unavailable') {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            console.log('[JOIN] Peer unavailable, retrying in 2s...');
                            if (onStatusUpdate) onStatusUpdate('Sala não respondeu, tentando novamente...');
                            setTimeout(attemptConnect, 2000);
                        } else {
                            resolved = true;
                            reject(new Error('Sala não encontrada. Verifique se o código está correto e se o host está aguardando.'));
                        }
                    } else if (err.type === 'network' || err.type === 'server-error') {
                        resolved = true;
                        reject(new Error('Erro de rede. Verifique sua conexão.'));
                    }
                }
            });

            peer.on('disconnected', () => {
                if (!destroyed && peer) {
                    try { peer.reconnect(); } catch (e) {}
                }
            });

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('Tempo esgotado. Verifique o código e sua conexão.'));
                }
            }, 30000);
        });
    }

    function send(data) {
        if (conn && conn.open) {
            console.log('[CONN] Sending:', data);
            conn.send(data);
            return true;
        }
        console.warn('[CONN] Cannot send, connection not open');
        return false;
    }

    function close() {
        cleanUp();
    }

    function onMessage(cb) { onMessageCallback = cb; }
    function onOpen(cb) { onOpenCallback = cb; }
    function onClose(cb) { onCloseCallback = cb; }

    function isConnected() {
        return conn && conn.open;
    }

    function isHostReady() {
        return hostReady;
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
        isHostReady,
        generateRoomId
    };
})();
