/* ============================================
   DEBUG — renderiza em todos os .debug-output
   ============================================ */
var Debug = (function () {
    var entries = [];
    var MAX = 150;

    function ts() {
        var d = new Date();
        return ('0' + d.getMinutes()).slice(-2) + ':' +
               ('0' + d.getSeconds()).slice(-2);
    }

    function kindOf(msg) {
        if (/ERRO|erro|falha|expirou|NAO |nao abriu|fechad/i.test(msg)) return 'err';
        if (/ABERTO|INICIANDO|REVANCHE|criada|conectado!/i.test(msg)) return 'ok';
        if (/<</.test(msg)) return 'in';
        if (/>>/.test(msg)) return 'out';
        return 'sys';
    }

    function clean(msg) {
        return msg
            .replace(/^CONN >>\s*/, '› ')
            .replace(/^CONN <<\s*/, '‹ ')
            .replace(/^HOST >>\s*/, '[H] ')
            .replace(/^JOIN >>\s*/, '[G] ')
            .replace(/^APP >>\s*/, '• ')
            .replace(/^HS >>\s*/, '~ ');
    }

    function log() {
        var msg = Array.prototype.slice.call(arguments).map(function (a) {
            if (a && typeof a === 'object') {
                try { return JSON.stringify(a); } catch (e) { return String(a); }
            }
            return String(a);
        }).join(' ');

        entries.push({ t: ts(), m: clean(msg), k: kindOf(msg) });
        if (entries.length > MAX) entries.shift();

        if (window.console) console.log('[' + ts() + '] ' + msg);
        render();
    }

    function render() {
        var outs = document.querySelectorAll('.debug-output');
        if (!outs.length) return;

        var html = entries.map(function (e) {
            return '<span class="dbg-line ' + e.k + '">' +
                   '<span class="dbg-time">' + e.t + '</span>' +
                   '<span class="dbg-msg">' + escapeHtml(e.m) + '</span>' +
                   '</span>';
        }).join('');

        for (var i = 0; i < outs.length; i++) {
            outs[i].innerHTML = html;
            outs[i].scrollTop = outs[i].scrollHeight;
        }
    }

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function clear() { entries = []; render(); }

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

    function watchOpen() {
        stopPoll();
        var tries = 0;
        openPoll = setInterval(function () {
            tries++;
            if (killed) { stopPoll(); return; }
            if (conn && conn.open) {
                Debug.log('CONN >> open via polling (' + tries + ')');
                fireOpen();
            } else if (tries > 100) {
                Debug.log('CONN >> canal nao abriu');
                stopPoll();
            }
        }, 200);
    }

    function attach(c) {
        conn = c;
        openFired = false;
        Debug.log('CONN >> attach ' + c.peer.replace(PREFIX, ''));

        c.on('open', function () { fireOpen(); });

        c.on('data', function (data) {
            Debug.log('CONN << ' + (data && data.type ? data.type : '?'));
            if (cbMessage) cbMessage(data);
        });

        c.on('close', function () {
            Debug.log('CONN >> conexao fechada');
            stopPoll();
            if (cbClose) cbClose();
        });

        c.on('error', function (err) {
            Debug.log('CONN >> ERRO ' + (err && err.type ? err.type : err));
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
            Debug.log('HOST >> criando sala ' + code);
            if (status) status('Conectando ao servidor...');

            peer = makePeer(id);
            var done = false;

            peer.on('open', function () {
                Debug.log('HOST >> sala criada e registrada');
                if (!done) {
                    done = true;
                    if (status) status('Aguardando oponente...');
                    resolve(code);
                }
            });

            peer.on('connection', function (c) {
                Debug.log('HOST >> oponente chegou');
                if (status) status('Oponente encontrado...');
                attach(c);
            });

            peer.on('error', function (err) {
                var t = err && err.type ? err.type : 'desconhecido';
                Debug.log('HOST >> ERRO ' + t);
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
                Debug.log('HOST >> reconectando ao servidor');
                if (!killed && peer && !peer.destroyed) {
                    try { peer.reconnect(); } catch (e) {}
                }
            });

            setTimeout(function () {
                if (!done) { done = true; reject(new Error('Tempo esgotado ao registrar a sala.')); }
            }, 20000);
        });
    }

    /* ---------- JOIN ---------- */
    function join(code, status) {
        return new Promise(function (resolve, reject) {
            killed = false;
            destroyPeer();

            var target = PREFIX + code.toUpperCase().trim();
            Debug.log('JOIN >> buscando sala ' + code);
            if (status) status('Conectando ao servidor...');

            peer = makePeer(null);
            var done = false;
            var tries = 0;

            function tryConnect() {
                if (done || killed) return;
                tries++;
                Debug.log('JOIN >> tentativa ' + tries);
                if (status) status('Procurando sala... (' + tries + '/4)');

                var c = peer.connect(target, { reliable: true });

                var to = setTimeout(function () {
                    if (done) return;
                    if (tries < 4) tryConnect();
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
                    Debug.log('JOIN >> ERRO ' + (e && e.type));
                    if (!done && tries < 4) setTimeout(tryConnect, 1200);
                });
            }

            peer.on('open', function () { tryConnect(); });

            peer.on('error', function (err) {
                var t = err && err.type ? err.type : 'desconhecido';
                Debug.log('JOIN >> ERRO ' + t);
                if (done) return;
                if (t === 'peer-unavailable') {
                    if (tries < 4) setTimeout(tryConnect, 1500);
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
                if (!done) { done = true; reject(new Error('Tempo esgotado ao conectar.')); }
            }, 35000);
        });
    }

    function send(data) {
        if (conn && conn.open) {
            try {
                conn.send(data);
                Debug.log('CONN >> ' + (data && data.type ? data.type : '?'));
                return true;
            } catch (e) {
                Debug.log('CONN >> falha ao enviar');
                return false;
            }
        }
        return false;
    }

    function close() {
        Debug.log('CONN >> encerrando');
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
