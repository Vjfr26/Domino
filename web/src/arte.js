/* Todo el arte del dominó se dibuja por código al arrancar: las 28 fichas de marfil, el reverso,
   las mesas de madera y fieltro, los retratos de los jugadores (con tres caras), partículas,
   estrellas, iconos y botones. */

const ANCHO = 1280;
const ALTO = 720;
const TEX_W = 96, TEX_H = 192; // tamaño de la textura de una ficha (se escala al dibujarla)

const TEMAS = [
    { clave: 'plaza', fieltro: ['#36a568', '#17683f', '#093820'], madera: ['#c99358', '#93602f', '#5e3b1a'], reverso: 0xa8324a, filo: '#e6c77a', musica: 'plaza' },
    { clave: 'club', fieltro: ['#3a7cc0', '#1a4d86', '#0a2546'], madera: ['#7d4c2c', '#4f2d18', '#2b170b'], reverso: 0x2f5fb0, filo: '#dcb860', musica: 'club' },
    { clave: 'final', fieltro: ['#b03a4e', '#701b2c', '#360812'], madera: ['#3e2e25', '#241810', '#110a06'], reverso: 0x23304f, filo: '#f4d070', musica: 'final' },
];

const PERSONAJES = {
    tu: { fondo: '#3a7bd5', piel: '#f0c08a', pelo: '#2b1d14', estilo: 'corto', ropa: '#f2f2f2', acc: [] },
    pedro: { fondo: '#d9534f', piel: '#d9a066', pelo: '#1c1410', estilo: 'corto', ropa: '#2e4a7a', acc: ['bigote', 'gorra'] },
    lucia: { fondo: '#8e44ad', piel: '#c98b5e', pelo: '#2a1a12', estilo: 'largo', ropa: '#f1c40f', acc: ['pendientes'] },
    andres: { fondo: '#27ae60', piel: '#f1c27d', pelo: '#7a4b26', estilo: 'corto', ropa: '#34495e', acc: ['gafas'] },
    ramon: { fondo: '#3d566e', piel: '#e8b98a', pelo: '#dadada', estilo: 'canoso', ropa: '#7f1d1d', acc: ['barba', 'sombrero'] },
    carmen: { fondo: '#e67e22', piel: '#d29a6a', pelo: '#3b2416', estilo: 'mono', ropa: '#16a085', acc: ['flor', 'pendientes'] },
};

const Arte = (() => {
    function lienzo(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return [c, c.getContext('2d')];
    }

    function registrar(escena, clave, canvas, fw, fh) {
        if (escena.textures.exists(clave)) escena.textures.remove(clave);
        const tex = escena.textures.addCanvas(clave, canvas);
        if (fw) {
            let i = 0;
            for (let y = 0; y + fh <= canvas.height; y += fh) for (let x = 0; x + fw <= canvas.width; x += fw) tex.add(i++, 0, x, y, fw, fh);
        }
        return tex;
    }

    function redondeado(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    /* ---------------- Fichas ---------------- */
    const PUNTOS = {
        0: [], 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
        4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
        6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
    };

    function cuerpoFicha(g, W, H) {
        const r = 15;
        // Canto (algo de grosor abajo y a la derecha)
        redondeado(g, 2, 3, W - 3, H - 3, r);
        g.fillStyle = '#b9aa88'; g.fill();
        // Cara
        redondeado(g, 1, 1, W - 5, H - 6, r);
        const grad = g.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#fffdf7'); grad.addColorStop(0.55, '#f6efde'); grad.addColorStop(1, '#e8dcc0');
        g.fillStyle = grad; g.fill();
        g.lineWidth = 2; g.strokeStyle = '#8c7b58'; g.stroke();
        // Brillo del borde superior
        redondeado(g, 5, 5, W - 13, H - 14, r - 4);
        g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
    }

    function ficha(escena, a, b) {
        const [c, g] = lienzo(TEX_W, TEX_H);
        const W = TEX_W, H = TEX_H;
        cuerpoFicha(g, W, H);
        const cy = (H - 5) / 2;
        // Raya del medio, grabada
        g.lineCap = 'round';
        g.strokeStyle = '#7d6c4c'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(14, cy); g.lineTo(W - 18, cy); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(14, cy + 2.5); g.lineTo(W - 18, cy + 2.5); g.stroke();
        // Puntos de cada mitad
        const mitad = (H - 5) / 2;
        [[a, 0], [b, mitad]].forEach(([n, y0]) => {
            const mx = (W - 4) / 2, my = y0 + mitad / 2;
            for (const [col, fila] of PUNTOS[n]) {
                const x = mx + (col - 1) * 24, y = my + (fila - 1) * 24;
                g.beginPath(); g.arc(x, y, 8.5, 0, Math.PI * 2);
                const pg = g.createRadialGradient(x - 2, y - 2, 1, x, y, 9);
                pg.addColorStop(0, '#3d3a36'); pg.addColorStop(1, '#0d0c0b');
                g.fillStyle = pg; g.fill();
                g.beginPath(); g.arc(x + 1, y + 1.5, 7, 0.2, Math.PI * 0.8);
                g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.5; g.stroke();
            }
        });
        // Clavito de latón
        const lx = (W - 4) / 2;
        const lg = g.createRadialGradient(lx - 2, cy - 2, 1, lx, cy, 7);
        lg.addColorStop(0, '#fff2b8'); lg.addColorStop(0.5, '#d4a640'); lg.addColorStop(1, '#7a5a1a');
        g.beginPath(); g.arc(lx, cy, 6.5, 0, Math.PI * 2); g.fillStyle = lg; g.fill();
        registrar(escena, `ficha_${a}${b}`, c);
    }

    function reverso(escena) {
        const [c, g] = lienzo(TEX_W, TEX_H);
        const W = TEX_W, H = TEX_H;
        redondeado(g, 2, 3, W - 3, H - 3, 15); g.fillStyle = '#777'; g.fill();
        redondeado(g, 1, 1, W - 5, H - 6, 15);
        const grad = g.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#c4c4c4');
        g.fillStyle = grad; g.fill();
        g.lineWidth = 2; g.strokeStyle = '#555'; g.stroke();
        // Rombos
        g.save();
        redondeado(g, 10, 10, W - 23, H - 26, 9); g.clip();
        g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
        for (let k = -H; k < W + H; k += 16) {
            g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.stroke();
            g.beginPath(); g.moveTo(k, H); g.lineTo(k + H, 0); g.stroke();
        }
        g.restore();
        redondeado(g, 10, 10, W - 23, H - 26, 9);
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke();
        // Medallón
        const cx = (W - 4) / 2, cy = (H - 5) / 2;
        g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke();
        estrellaEn(g, cx, cy, 14, 6, 5);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
        registrar(escena, 'reverso', c);
    }

    function sombraFicha(escena) {
        const [c, g] = lienzo(TEX_W, TEX_H);
        redondeado(g, 0, 0, TEX_W, TEX_H, 16); g.fillStyle = '#000'; g.fill();
        registrar(escena, 'sombra_ficha', c);
    }

    function brillo(escena) {
        const m = 26;
        const [c, g] = lienzo(TEX_W + m * 2, TEX_H + m * 2);
        g.shadowColor = '#ffffff'; g.shadowBlur = 18;
        redondeado(g, m - 2, m - 2, TEX_W + 0, TEX_H - 1, 17);
        g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.stroke();
        g.shadowBlur = 0;
        registrar(escena, 'brillo', c);
    }

    function hueco(escena) {
        const [c, g] = lienzo(TEX_W, TEX_H);
        redondeado(g, 4, 4, TEX_W - 8, TEX_H - 8, 14);
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill();
        g.setLineDash([14, 10]); g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke();
        registrar(escena, 'hueco', c);
    }

    /* ---------------- Mesas ---------------- */
    function mesa(escena, tema) {
        const clave = 'mesa_' + tema;
        if (escena.textures.exists(clave)) return clave;
        const T = TEMAS[tema];
        const [c, g] = lienzo(ANCHO, ALTO);
        // Madera
        const mg = g.createLinearGradient(0, 0, 0, ALTO);
        mg.addColorStop(0, T.madera[0]); mg.addColorStop(0.5, T.madera[1]); mg.addColorStop(1, T.madera[2]);
        g.fillStyle = mg; g.fillRect(0, 0, ANCHO, ALTO);
        for (let i = 0; i < 160; i++) {
            const y = Math.random() * ALTO, amp = 2 + Math.random() * 6, fase = Math.random() * 6;
            g.beginPath();
            for (let x = 0; x <= ANCHO; x += 20) g.lineTo(x, y + Math.sin(x / (60 + i % 40) + fase) * amp);
            g.strokeStyle = Math.random() < 0.5 ? `rgba(0,0,0,${0.05 + Math.random() * 0.08})` : `rgba(255,230,190,${0.03 + Math.random() * 0.05})`;
            g.lineWidth = 1 + Math.random() * 2; g.stroke();
        }
        // Fieltro
        const m = 26, R = 48;
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 20; g.shadowOffsetY = 4;
        redondeado(g, m, m, ANCHO - 2 * m, ALTO - 2 * m, R);
        const fg = g.createRadialGradient(ANCHO / 2, ALTO * 0.45, 60, ANCHO / 2, ALTO / 2, ANCHO * 0.62);
        fg.addColorStop(0, T.fieltro[0]); fg.addColorStop(0.6, T.fieltro[1]); fg.addColorStop(1, T.fieltro[2]);
        g.fillStyle = fg; g.fill();
        g.restore();
        g.save();
        redondeado(g, m, m, ANCHO - 2 * m, ALTO - 2 * m, R); g.clip();
        // Textura del paño
        for (let i = 0; i < 26000; i++) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
            g.fillRect(Math.random() * ANCHO, Math.random() * ALTO, 1.5, 1.5);
        }
        // Sombra interior del borde
        redondeado(g, m - 30, m - 30, ANCHO - 2 * m + 60, ALTO - 2 * m + 60, R + 30);
        g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 40;
        g.lineWidth = 60; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.stroke();
        g.restore();
        // Pespunte y filo dorado
        redondeado(g, m + 14, m + 14, ANCHO - 2 * m - 28, ALTO - 2 * m - 28, R - 12);
        g.setLineDash([10, 8]); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.stroke();
        g.setLineDash([]);
        redondeado(g, m, m, ANCHO - 2 * m, ALTO - 2 * m, R);
        g.lineWidth = 3; g.strokeStyle = T.filo; g.stroke();
        // Emblema muy suave en el centro
        g.beginPath(); g.arc(ANCHO / 2, ALTO * 0.43, 150, 0, Math.PI * 2);
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.05)'; g.stroke();
        g.beginPath(); g.arc(ANCHO / 2, ALTO * 0.43, 138, 0, Math.PI * 2);
        g.lineWidth = 1.5; g.stroke();
        registrar(escena, clave, c);
        return clave;
    }

    /* ---------------- Retratos ---------------- */
    function retrato(escena, id) {
        const P = PERSONAJES[id];
        const S = 112;
        const [c, g] = lienzo(S * 3, S);
        for (let cara = 0; cara < 3; cara++) {
            g.save();
            g.translate(cara * S, 0);
            dibujarCara(g, P, cara, S);
            g.restore();
        }
        registrar(escena, 'av_' + id, c, S, S);
    }

    function dibujarCara(g, P, cara, S) {
        const cx = S / 2, cy = S / 2, R = S / 2 - 5;
        g.save();
        g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
        const bg = g.createRadialGradient(cx - 14, cy - 18, 6, cx, cy, R);
        bg.addColorStop(0, aclarar(P.fondo, 0.35)); bg.addColorStop(1, P.fondo);
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        // Pelo largo por detrás
        if (P.estilo === 'largo') { g.beginPath(); g.ellipse(cx, cy + 6, 33, 42, 0, 0, Math.PI * 2); g.fillStyle = P.pelo; g.fill(); }
        // Cuerpo y cuello
        g.beginPath(); g.ellipse(cx, S + 14, 46, 40, 0, 0, Math.PI * 2); g.fillStyle = P.ropa; g.fill();
        g.fillStyle = P.piel; g.fillRect(cx - 9, cy + 20, 18, 16);
        g.beginPath(); g.moveTo(cx - 14, S - 26); g.lineTo(cx, S - 12); g.lineTo(cx + 14, S - 26); g.lineWidth = 3; g.strokeStyle = oscurecer(P.ropa, 0.25); g.stroke();
        // Orejas y cabeza
        for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 25, cy + 2, 6, 0, Math.PI * 2); g.fillStyle = P.piel; g.fill(); }
        g.beginPath(); g.ellipse(cx, cy - 2, 25, 29, 0, 0, Math.PI * 2);
        const pg = g.createRadialGradient(cx - 8, cy - 12, 4, cx, cy, 32);
        pg.addColorStop(0, aclarar(P.piel, 0.15)); pg.addColorStop(1, P.piel);
        g.fillStyle = pg; g.fill();
        if (P.acc.includes('barba')) {
            g.beginPath(); g.moveTo(cx - 24, cy + 2); g.quadraticCurveTo(cx - 20, cy + 34, cx, cy + 34); g.quadraticCurveTo(cx + 20, cy + 34, cx + 24, cy + 2);
            g.quadraticCurveTo(cx, cy + 16, cx - 24, cy + 2); g.fillStyle = P.pelo; g.fill();
        }
        // Pelo
        g.fillStyle = P.pelo;
        if (P.estilo === 'corto' || P.estilo === 'largo') {
            g.beginPath(); g.ellipse(cx, cy - 20, 27, 15, 0, Math.PI, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(cx + 4, cy - 22, 24, 10, -0.2, 0, Math.PI * 2); g.fill();
        } else if (P.estilo === 'canoso') {
            for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 23, cy - 8, 6, 11, 0, 0, Math.PI * 2); g.fill(); }
        } else if (P.estilo === 'mono') {
            g.beginPath(); g.ellipse(cx, cy - 20, 27, 15, 0, Math.PI, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(cx, cy - 18, 26, 8, 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.arc(cx, cy - 40, 11, 0, Math.PI * 2); g.fill();
        }
        // Cejas
        const enfado = cara === 2;
        g.strokeStyle = P.estilo === 'canoso' ? '#bdbdbd' : oscurecer(P.pelo, 0.1); g.lineWidth = 3; g.lineCap = 'round';
        for (const s of [-1, 1]) {
            g.beginPath();
            if (enfado) { g.moveTo(cx + s * 15, cy - 14); g.lineTo(cx + s * 5, cy - 10); } else { g.moveTo(cx + s * 15, cy - 13); g.quadraticCurveTo(cx + s * 10, cy - 17, cx + s * 5, cy - 13); }
            g.stroke();
        }
        // Ojos
        g.fillStyle = '#1d1712'; g.strokeStyle = '#1d1712'; g.lineWidth = 3;
        for (const s of [-1, 1]) {
            const ex = cx + s * 10, ey = cy - 3;
            if (cara === 1) { g.beginPath(); g.arc(ex, ey + 2, 4.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
            else if (cara === 2) { g.beginPath(); g.moveTo(ex - 4, ey); g.lineTo(ex + 4, ey); g.stroke(); }
            else { g.beginPath(); g.ellipse(ex, ey, 3.2, 4, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 1, ey - 1.5, 1.1, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1d1712'; }
        }
        // Nariz
        g.strokeStyle = oscurecer(P.piel, 0.25); g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx, cy + 1); g.quadraticCurveTo(cx + 4, cy + 8, cx - 1, cy + 9); g.stroke();
        // Mejillas al reír
        if (cara === 1) for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 15, cy + 9, 5, 3, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,90,90,0.35)'; g.fill(); }
        // Boca
        if (cara === 1) {
            g.beginPath(); g.moveTo(cx - 10, cy + 14); g.quadraticCurveTo(cx, cy + 28, cx + 10, cy + 14); g.closePath();
            g.fillStyle = '#7a1f22'; g.fill();
            g.beginPath(); g.moveTo(cx - 8, cy + 15); g.lineTo(cx + 8, cy + 15); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
        } else {
            g.beginPath(); g.lineWidth = 2.5; g.strokeStyle = '#7a3324';
            if (cara === 2) { g.moveTo(cx - 8, cy + 19); g.quadraticCurveTo(cx, cy + 15, cx + 8, cy + 19); } else { g.moveTo(cx - 8, cy + 16); g.quadraticCurveTo(cx, cy + 22, cx + 8, cy + 16); }
            g.stroke();
        }
        // Accesorios
        if (P.acc.includes('bigote')) {
            g.fillStyle = P.pelo;
            g.beginPath(); g.moveTo(cx, cy + 11); g.quadraticCurveTo(cx - 9, cy + 7, cx - 15, cy + 15); g.quadraticCurveTo(cx - 7, cy + 13, cx, cy + 14);
            g.quadraticCurveTo(cx + 7, cy + 13, cx + 15, cy + 15); g.quadraticCurveTo(cx + 9, cy + 7, cx, cy + 11); g.fill();
        }
        if (P.acc.includes('gafas')) {
            g.strokeStyle = '#222'; g.lineWidth = 2.5;
            for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 10, cy - 3, 7.5, 0, Math.PI * 2); g.stroke(); }
            g.beginPath(); g.moveTo(cx - 2.5, cy - 4); g.lineTo(cx + 2.5, cy - 4); g.stroke();
        }
        if (P.acc.includes('pendientes')) for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 26, cy + 10, 3.5, 0, Math.PI * 2); g.fillStyle = '#ffd34d'; g.fill(); }
        if (P.acc.includes('gorra')) {
            g.fillStyle = '#c0392b';
            g.beginPath(); g.ellipse(cx, cy - 20, 28, 17, 0, Math.PI, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(cx + 18, cy - 20, 18, 5, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 2, cy - 28, 4, 0, Math.PI * 2); g.fill();
        }
        if (P.acc.includes('sombrero')) {
            g.fillStyle = '#2c2c34';
            g.beginPath(); g.ellipse(cx, cy - 22, 38, 8, 0, 0, Math.PI * 2); g.fill();
            redondeado(g, cx - 22, cy - 48, 44, 28, 10); g.fill();
            g.fillStyle = '#b8862f'; g.fillRect(cx - 22, cy - 28, 44, 5);
        }
        if (P.acc.includes('flor')) {
            for (let k = 0; k < 5; k++) { const ang = k * Math.PI * 0.4; g.beginPath(); g.arc(cx + 20 + Math.cos(ang) * 5, cy - 26 + Math.sin(ang) * 5, 4.5, 0, Math.PI * 2); g.fillStyle = '#ff4f7b'; g.fill(); }
            g.beginPath(); g.arc(cx + 20, cy - 26, 3, 0, Math.PI * 2); g.fillStyle = '#ffd34d'; g.fill();
        }
        g.restore();
        // Aro
        g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = '#fff7e6'; g.stroke();
        g.beginPath(); g.arc(cx, cy, R + 3, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.stroke();
    }

    function hexARgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function aclarar(h, k) { const [r, g, b] = hexARgb(h); return `rgb(${Math.round(r + (255 - r) * k)},${Math.round(g + (255 - g) * k)},${Math.round(b + (255 - b) * k)})`; }
    function oscurecer(h, k) { const [r, g, b] = hexARgb(h); return `rgb(${Math.round(r * (1 - k))},${Math.round(g * (1 - k))},${Math.round(b * (1 - k))})`; }

    /* ---------------- Piezas pequeñas ---------------- */
    function estrellaEn(g, cx, cy, rExt, rInt, puntas = 5) {
        g.beginPath();
        for (let i = 0; i < puntas * 2; i++) {
            const r = i % 2 ? rInt : rExt;
            const a = -Math.PI / 2 + (i * Math.PI) / puntas;
            g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.closePath();
    }

    function piezas(escena) {
        let [c, g] = lienzo(24, 24);
        let rg = g.createRadialGradient(12, 12, 0, 12, 12, 12);
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,255,255,0.7)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 24, 24);
        registrar(escena, 'chispa', c);

        [c, g] = lienzo(40, 40);
        rg = g.createRadialGradient(20, 20, 0, 20, 20, 20);
        rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 40, 40);
        registrar(escena, 'polvo', c);

        [c, g] = lienzo(12, 7);
        g.fillStyle = '#fff'; g.fillRect(0, 0, 12, 7);
        registrar(escena, 'confeti', c);

        [c, g] = lienzo(64, 64);
        estrellaEn(g, 32, 34, 29, 13);
        let eg = g.createLinearGradient(0, 4, 0, 62);
        eg.addColorStop(0, '#fff3a3'); eg.addColorStop(0.5, '#ffcf3a'); eg.addColorStop(1, '#e08a12');
        g.fillStyle = eg; g.fill(); g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = '#7a4a08'; g.stroke();
        registrar(escena, 'estrella', c);

        [c, g] = lienzo(64, 64);
        estrellaEn(g, 32, 34, 29, 13);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.stroke();
        registrar(escena, 'estrella_vacia', c);

        // Candado
        [c, g] = lienzo(48, 56);
        g.beginPath(); g.arc(24, 22, 13, Math.PI, 0); g.lineWidth = 6; g.strokeStyle = '#c9ced8'; g.stroke();
        redondeado(g, 6, 22, 36, 30, 7); g.fillStyle = '#e8b93a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7a5a12'; g.stroke();
        g.beginPath(); g.arc(24, 35, 4, 0, Math.PI * 2); g.fillStyle = '#5a400a'; g.fill(); g.fillRect(22, 36, 4, 8);
        registrar(escena, 'candado', c);

        // Trofeo
        [c, g] = lienzo(170, 190);
        const tg = g.createLinearGradient(20, 0, 150, 0);
        tg.addColorStop(0, '#b8860b'); tg.addColorStop(0.35, '#ffe27a'); tg.addColorStop(0.6, '#ffc93a'); tg.addColorStop(1, '#a8740a');
        g.fillStyle = tg; g.strokeStyle = '#6b4a06'; g.lineWidth = 4;
        for (const s of [-1, 1]) { g.beginPath(); g.arc(85 + s * 58, 52, 22, 0, Math.PI * 2); g.lineWidth = 9; g.strokeStyle = '#d9a520'; g.stroke(); }
        g.lineWidth = 4; g.strokeStyle = '#6b4a06';
        g.beginPath(); g.moveTo(32, 18); g.lineTo(138, 18); g.quadraticCurveTo(136, 104, 85, 116); g.quadraticCurveTo(34, 104, 32, 18); g.closePath(); g.fill(); g.stroke();
        g.fillRect(74, 114, 22, 30); g.strokeRect(74, 114, 22, 30);
        redondeado(g, 44, 142, 82, 18, 5); g.fill(); g.stroke();
        redondeado(g, 34, 158, 102, 24, 6); g.fill(); g.stroke();
        estrellaEn(g, 85, 60, 22, 10); g.fillStyle = '#fff6c8'; g.fill();
        registrar(escena, 'trofeo', c);

        // Botones y paneles (nine-slice)
        boton(escena, 'boton', ['#fffaf0', '#f0e2c4'], '#a8895a', '#c9b08a');
        boton(escena, 'boton_oro', ['#fff0a8', '#ffc83d'], '#8a5a08', '#c98a10');
        [c, g] = lienzo(64, 64);
        redondeado(g, 2, 2, 60, 60, 18); g.fillStyle = 'rgba(14,20,18,0.86)'; g.fill();
        g.lineWidth = 2.5; g.strokeStyle = '#e6c77a'; g.stroke();
        registrar(escena, 'panel', c);
        [c, g] = lienzo(64, 64);
        redondeado(g, 2, 2, 60, 60, 20); g.fillStyle = '#fffaf0'; g.fill();
        g.lineWidth = 3; g.strokeStyle = '#e6c77a'; g.stroke();
        registrar(escena, 'globo', c);

        // Ficha de extremo: círculo oscuro con aro dorado
        [c, g] = lienzo(48, 48);
        g.beginPath(); g.arc(24, 24, 20, 0, Math.PI * 2); g.fillStyle = 'rgba(10,16,14,0.82)'; g.fill();
        g.lineWidth = 3; g.strokeStyle = '#e6c77a'; g.stroke();
        registrar(escena, 'chip', c);

        // Anillo de turno
        [c, g] = lienzo(140, 140);
        g.shadowColor = '#ffffff'; g.shadowBlur = 14;
        g.beginPath(); g.arc(70, 70, 56, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
        registrar(escena, 'anillo', c);

        iconos(escena);
    }

    function boton(escena, clave, grad, borde, base) {
        const [c, g] = lienzo(64, 64);
        redondeado(g, 2, 6, 60, 56, 18); g.fillStyle = base; g.fill();
        redondeado(g, 2, 2, 60, 55, 18);
        const bg = g.createLinearGradient(0, 0, 0, 56);
        bg.addColorStop(0, grad[0]); bg.addColorStop(1, grad[1]);
        g.fillStyle = bg; g.fill(); g.lineWidth = 2.5; g.strokeStyle = borde; g.stroke();
        registrar(escena, clave, c);
    }

    function iconos(escena) {
        const icono = (clave, dibujar) => { const [c, g] = lienzo(48, 48); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; dibujar(g); registrar(escena, clave, c); };
        const altavoz = (g) => { g.beginPath(); g.moveTo(8, 18); g.lineTo(16, 18); g.lineTo(26, 9); g.lineTo(26, 39); g.lineTo(16, 30); g.lineTo(8, 30); g.closePath(); g.fill(); };
        icono('ic_sonido', (g) => { altavoz(g); g.beginPath(); g.arc(26, 24, 8, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(26, 24, 15, -0.9, 0.9); g.stroke(); });
        icono('ic_mudo', (g) => { altavoz(g); g.beginPath(); g.moveTo(32, 17); g.lineTo(42, 31); g.moveTo(42, 17); g.lineTo(32, 31); g.stroke(); });
        icono('ic_pausa', (g) => { g.fillRect(12, 9, 8, 30); g.fillRect(28, 9, 8, 30); });
        icono('ic_pista', (g) => {
            g.beginPath(); g.arc(24, 19, 12, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(29, 33); g.lineTo(19, 33); g.closePath(); g.fill();
            g.fillRect(18, 35, 12, 4); g.fillRect(20, 41, 8, 3);
        });
    }

    return {
        generar(escena) {
            for (const f of TODAS) ficha(escena, f.a, f.b);
            reverso(escena);
            sombraFicha(escena);
            brillo(escena);
            hueco(escena);
            for (const id of Object.keys(PERSONAJES)) retrato(escena, id);
            piezas(escena);
        },
        mesa,
    };
})();
