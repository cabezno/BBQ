/**
 * BBQ - Escapado de datos ajenos.
 * Todo lo que llega de otro peer o del directorio (nombres, textos, ids) se pinta
 * con estas funciones antes de entrar a un innerHTML: así nadie puede meter código
 * en el teléfono de otro.
 */
(function () {
    // Texto → HTML seguro (contenido de elementos y atributos entre comillas).
    window.escHtml = function (s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
    // Identificadores (peerId, id de mensaje/adjunto) que van dentro de onclick='...':
    // solo letras, números, _ . -
    window.safeId = function (s) {
        return String(s == null ? '' : s).replace(/[^\w.-]/g, '');
    };

    // Avatar: foto (data:image) si hay; si el nombre empieza con emoji/símbolo (bots, tiendas), ese emoji;
    // si no, iniciales sobre un color estable derivado del id. Todo escapado.
    window.bbqAvatar = function (id, name, avatar) {
        const a = String(avatar || '');
        if (a.startsWith('data:image')) return `<img class="bbq-av-img" src="${window.escHtml(a)}" alt="">`;
        const n = String(name || '').trim();
        const words = n.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
        if (!words.length || /^[^\p{L}\p{N}]/u.test(n)) {
            const emoji = (a && a !== '👤') ? a : (n.match(/^\p{Extended_Pictographic}/u) || ['👤'])[0];
            return `<span class="bbq-av bbq-av-emoji">${window.escHtml(emoji)}</span>`;
        }
        const ini = (words[0][0] + (words.length > 1 ? words[1][0] : '')).toUpperCase();
        let h = 0; const key = String(id || n); for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
        return `<span class="bbq-av" style="background:hsl(${h},45%,42%)">${window.escHtml(ini)}</span>`;
    };
})();
