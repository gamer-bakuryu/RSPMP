/* ============================================
   DEBUG (global)
   ============================================ */
var Debug = (function () {
    var lines = [];
    function ts() {
        var d = new Date();
        return ('0' + d.getMinutes()).slice(-2) + ':' +
               ('0' + d.getSeconds()).slice(-2) + '.' +
               ('00' + d.getMilliseconds()).slice(-3);
    }
    function log() {
        var msg = Array.prototype.slice.call(arguments).map(function (a) {
            if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch (e) { return String(a); }
            }
            return String(a);
        }).join(' ');
        var full = '[' + ts() + '] ' + msg;
        lines.push(full);
        if (lines.length > 200) lines.shift();
        if (window.console) console.log(full);
        render();
    }
    function render() {
        var body = document.getElementById('debug-body');
        if (!body) return;
        body.textContent = lines.join('\n');
        body.scrollTop = body.scrollHeight;
    }
    function clear() { lines = []; render(); }
    return { log: log, clear: clear, render: render };
})();


/* ============================================
   CONNECTION (PeerJS)
   ============================================ */
var Connection = (function () {
    var peer = null;
    var conn = null;
    var cbOpen = null, cbMessage = null, cbClose = null;
    var openFired = false;
    var openPoll = null;
    var killed = false;

    var PREFIX = 'rspmp-v2-';

    function randomCode() {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var r = '';
        for (var i = 0; i < 6; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
        return r;
    }

    function stopPoll() {
        if (openPoll) { clearInterval(openPoll); openPoll = null; }
    }

    function fireOpen() {
        if (openFired) return;
        openFired = true;
        stopPoll();
        Debug.log('CONN >> canal ABERTO');
        if (cbOpen) cbOpen();
    }

    // Vigia o estado "open" da conexão (o evento 'open' nem sempre dispara no host)
    function watchOpen() {
        stopPoll();
        var tries = 0;
        openPoll = setInterval(function () {
            tries++;
            if (killed) { stopPoll(); return; }
            if (conn && conn.open) {
                Debug.log('CONN >> open detectado por polling (try ' + tries + ')');
                fireOpen();
            } else if (tries > 100) { // 20s
                Debug.log('CONN >> polling expirou, canal nao abriu');
                stopPoll();
            }
        }, 200);
    }

    function attach(c) {
        conn = c;
        openFired = false;
        Debug.log('CONN >> attach. peer=' + c.peer + ' open=' + c.open);

        c.on('open', function () {
            Debug.log('CONN >> evento open');
            fireOpen();
        });

        c.on('data', function (data) {
            Debug.log('CONN << recebido:', data);
            if (cbMessage) cbMessage(data);
        });

        c.on('close', function () {
            Debug.log('CONN >> close');
            stopPoll();
            if (cbClose) cbClose();
        });

        c.on('error', function (err) {
            Debug.log('CONN >> ERRO', err && err.type ? err.type : err);
        });

        if (c.open) fireOpen();
        else watchOpen();
    }

    function destroyPeer() {
        stopPoll();
        if (conn) { try { conn.close(); } catch (e) {} conn = null; }
        if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
        openFired = false;
    }

    function makePeer(id) {
        var opts = {
            debug: 0,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        };
        return id ? new Peer(id, opts) : new Peer(opts);
    }

    /* ---------- HOST ---------- */
    function host(status) {
        return new Promise(function (resolve, reject) {
            killed = false;
            destroyPeer();

            var code = randomCode();
            var id = PREFIX + code;
            Debug.log('HOST >> criando peer ' + id);
            if (status) status('Conectando ao servidor...');

            peer = makePeer(id);
            var done = false;

            peer.on('open', function (realId) {
                Debug.log('HOST >> registrado no servidor como ' + realId);
                if (!done) {
                    done = true;
                    if (status) status('Aguardando oponente...');
                    resolve(code);
                }
            });

            peer.on('connection', function (c) {
                Debug.log('HOST >> CONEXAO RECEBIDA de ' + c.peer);
                if (status) status('Oponente encontrado, conectando...');
                attach(c);
            });

            peer.on('error', function (err) {
                var t = err && err.type ? err.type : 'desconhecido';
                Debug.log('HOST >> ERRO peer: ' + t);
                if (!done) {
                    done = true;
                    if (t === 'unavailable-id') {
                        destroyPeer();
                        host(status).then(resolve).catch(reject);
                    } else {
                        reject(new Error('Erro (' + t + '). Tente novamente.'));
                    }
                }
            });

            peer.on('disconnected', function () {
                Debug.log('HOST >> desconectado do servidor, reconectando...');
                if (!killed && peer && !peer.destroyed) {
                    try { peer.reconnect(); } catch (e) {}
                }
            });

            setTimeout(function () {
                if (!done) {
                    done = true;
                    reject(new Error('Tempo esgotado ao registrar a sala.'));
                }
            }, 20000);
        });
    }

    /* ---------- JOIN ---------- */
    function join(code, status) {
        return new Promise(function (resolve, reject) {
            killed = false;
            destroyPeer();

            var target = PREFIX + code.toUpperCase().trim();
            Debug.log('JOIN >> alvo ' + target);
            if (status) status('Conectando ao servidor...');

            peer = makePeer(null);
            var done = false;
            var tries = 0;

            function tryConnect() {
                if (done || killed) return;
                tries++;
                Debug.log('JOIN >> tentativa ' + tries + ' -> ' + target);
                if (status) status('Procurando sala... (' + tries + '/4)');

                var c = peer.connect(target, { reliable: true });

                var to = setTimeout(function () {
                    if (done) return;
                    if (tries < 4) { tryConnect(); }
                    else {
                        done = true;
                        reject(new Error('Sala não encontrada. Confirme o código e se o host está na tela "Sala Criada".'));
                    }
                }, 7000);

                c.on('open', function () {
                    clearTimeout(to);
                    if (done) return;
                    done = true;
                    Debug.log('JOIN >> conectado!');
                    attach(c);
                    if (status) status('Conectado!');
                    resolve();
                });

                c.on('error', function (e) {
                    clearTimeout(to);
                    Debug.log('JOIN >> erro na conexao', e && e.type);
                    if (!done && tries < 4) setTimeout(tryConnect, 1200);
                });
            }

            peer.on('open', function (myId) {
                Debug.log('JOIN >> meu id ' + myId);
                tryConnect();
            });

            peer.on('error', function (err) {
                var t = err && err.type ? err.type : 'desconhecido';
                Debug.log('JOIN >> ERRO peer: ' + t);
                if (done) return;
                if (t === 'peer-unavailable') {
                    if (tries < 4) { setTimeout(tryConnect, 1500); }
                    else {
                        done = true;
                        reject(new Error('Sala não encontrada. Confirme o código e se o host está na tela "Sala Criada".'));
                    }
                } else if (t === 'network' || t === 'server-error' || t === 'socket-error') {
                    done = true;
                    reject(new Error('Erro de rede (' + t + ').'));
                }
            });

            peer.on('disconnected', function () {
                if (!killed && peer && !peer.destroyed) {
                    try { peer.reconnect(); } catch (e) {}
                }
            });

            setTimeout(function () {
                if (!done) {
                    done = true;
                    reject(new Error('Tempo esgotado ao conectar.'));
                }
            }, 35000);
        });
    }

    function send(data) {
        if (conn && conn.open) {
            try {
                conn.send(data);
                Debug.log('CONN >> enviado:', data);
                return true;
            } catch (e) {
                Debug.log('CONN >> falha ao enviar', e.message);
                return false;
            }
        }
        Debug.log('CONN >> NAO enviado (canal fechado):', data);
        return false;
    }

    function close() {
        Debug.log('CONN >> fechando tudo');
        killed = true;
        destroyPeer();
    }

    return {
        host: host,
        join: join,
        send: send,
        close: close,
        onOpen: function (f) { cbOpen = f; },
        onMessage: function (f) { cbMessage = f; },
        onClose: function (f) { cbClose = f; },
        isConnected: function () { return !!(conn && conn.open); }
    };
})();
