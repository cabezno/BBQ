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
})();
