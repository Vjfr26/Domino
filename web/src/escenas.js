/* Escenas fuera de la mesa: arranque, menú (principal, torneo, partida rápida y reglas) y pausa.
   Con ?mesa=N se entra directo a la mesa N del torneo y con ?rapida=2|4 a una partida rápida
   (útil para probar; ?auto hace que la computadora juegue también por ti y ?vel=N acelera). */

class Arranque extends Phaser.Scene {
    constructor() { super('Arranque'); }

    create() {
        this.add.text(ANCHO / 2, ALTO / 2, TXT.cargando, estiloTexto(26)).setOrigin(0.5);
        // Un fotograma para que se vea el texto antes de dibujar todo el arte
        this.time.delayedCall(30, () => {
            Arte.generar(this);
            const q = new URLSearchParams(location.search);
            const mesa = parseInt(q.get('mesa'), 10);
            if (mesa >= 1 && mesa <= MESAS_TORNEO.length) this.scene.start('Mesa', configTorneo(mesa - 1));
            else if (q.has('rapida')) {
                this.scene.start('Mesa', configRapida({
                    modo: q.get('rapida') === '2' ? 2 : 4, nivel: Phaser.Math.Clamp(parseInt(q.get('nivel'), 10) || 1, 0, 2),
                    meta: parseInt(q.get('meta'), 10) || 100, tema: Phaser.Math.Clamp(parseInt(q.get('tema'), 10) || 0, 0, 2),
                }));
            } else this.scene.start('Menu');
        });
    }
}

/* ===================================================================== */
class Menu extends Phaser.Scene {
    constructor() { super('Menu'); }

    init(d) { this.pantallaInicial = (d && d.pantalla) || 'principal'; }

    create() {
        this.cameras.main.fadeIn(450, 0, 0, 0);
        const tema = Math.min(Progreso.datos.desbloqueada, TEMAS.length) - 1;
        this.add.image(0, 0, Arte.mesa(this, tema)).setOrigin(0);
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.18).setOrigin(0);
        this.crearCadena();
        this.nav = null;
        this.sub = [];
        this.teclasExtra = [];
        this[this.pantallaInicial]();
        Sonido.musica('menu');
        this.input.keyboard.on('keydown', () => Sonido.iniciar());
        this.input.on('pointerdown', () => Sonido.iniciar());
    }

    /** Una fila de fichas de pie que cae en cadena cada pocos segundos. */
    crearCadena() {
        const fichas = [];
        const ids = Phaser.Utils.Array.Shuffle([...TODAS]).slice(0, 16);
        ids.forEach((f, i) => {
            const img = this.add.image(140 + i * 66, 676, `ficha_${f.a}${f.b}`).setOrigin(0.5, 1).setScale(0.36).setDepth(2);
            fichas.push(img);
        });
        const caer = () => {
            fichas.forEach((img, i) => this.tweens.add({
                targets: img, angle: 70, duration: 230, delay: 300 + i * 85, ease: 'Quad.easeIn',
                onComplete: () => { if (i % 2 === 0) Sonido.sfx('ficha'); },
            }));
            this.time.delayedCall(300 + fichas.length * 85 + 1600, () => {
                fichas.slice().reverse().forEach((img, i) => this.tweens.add({ targets: img, angle: 0, duration: 260, delay: i * 45, ease: 'Back.easeOut' }));
            });
        };
        caer();
        this.time.addEvent({ delay: 7000, loop: true, callback: caer });
        this.cadena = fichas;
    }

    limpiar(conCadena = false) {
        // La cadena de fichas solo adorna el menú principal (en las demás pantallas tapa botones)
        this.cadena.forEach((f) => f.setVisible(conCadena));
        if (this.nav) { this.nav.destruir(); this.nav = null; }
        for (const [k, f] of this.teclasExtra) this.input.keyboard.off(k, f);
        this.teclasExtra = [];
        this.sub.forEach((o) => o.destroy());
        this.sub = [];
    }

    tecla(nombre, f) { this.input.keyboard.on(nombre, f); this.teclasExtra.push([nombre, f]); }

    titulo(texto, y = 92, tam = 64) {
        const t = this.add.text(ANCHO / 2, y, texto, estiloTexto(tam, ORO, { fontStyle: '700', strokeThickness: 12, shadow: { offsetX: 0, offsetY: 6, color: '#000', blur: 10, fill: true } })).setOrigin(0.5).setDepth(10);
        this.sub.push(t);
        return t;
    }

    /* ---------------- Menú principal ---------------- */
    principal() {
        this.limpiar(true);
        const estilo = estiloTexto(118, ORO, { fontStyle: '700', strokeThickness: 16, shadow: { offsetX: 0, offsetY: 8, color: '#000', blur: 12, fill: true } });
        const letras = 'DOMINÓ'.split('').map((l) => this.add.text(0, -80, l, estilo).setOrigin(0.5).setDepth(10));
        const anchos = letras.map((t) => t.width - 18);
        let x = ANCHO / 2 - anchos.reduce((a, b) => a + b, 0) / 2;
        letras.forEach((t, i) => {
            t.x = x + anchos[i] / 2;
            x += anchos[i];
            this.tweens.add({ targets: t, y: 98, duration: 520, delay: i * 70, ease: 'Bounce.easeOut' });
            this.sub.push(t);
        });
        this.sub.push(this.add.text(ANCHO / 2, 172, TXT.lema, estiloTexto(24, CREMA)).setOrigin(0.5).setDepth(10));
        const s = Progreso.datos.stats;
        if (s.partidas) this.sub.push(this.add.text(ANCHO / 2, 206, TXT.estadisticas(s), estiloTexto(16, '#e8dcc0')).setOrigin(0.5).setDepth(10));
        const items = [
            [TXT.torneo, () => this.torneo()],
            [TXT.rapida, () => this.rapida()],
            [TXT.reglas, () => this.reglas()],
            [Sonido.activo ? TXT.sonidoSi : TXT.sonidoNo, (b) => b.texto.setText(Sonido.alternar() ? TXT.sonidoSi : TXT.sonidoNo)],
            [Sonido.musicaActiva ? TXT.musicaSi : TXT.musicaNo, (b) => b.texto.setText(Sonido.alternarMusica() ? TXT.musicaSi : TXT.musicaNo)],
        ];
        const botones = items.map(([t, f], i) => {
            const b = crearBoton(this, ANCHO / 2, 270 + i * 64, 360, 54, t, () => f(b), { tam: i < 3 ? 26 : 22 });
            b.setAlpha(0);
            this.tweens.add({ targets: b, alpha: 1, duration: 300, delay: 300 + i * 60 });
            return b;
        });
        this.sub.push(...botones);
        this.sub.push(this.add.text(ANCHO / 2, 708, TXT.creditos, estiloTexto(13, '#e8dcc0', { strokeThickness: 2 })).setOrigin(0.5).setDepth(10));
        this.nav = navegacion(this, botones);
    }

    /* ---------------- Torneo ---------------- */
    torneo() {
        this.limpiar();
        this.titulo(TXT.torneo);
        const d = Progreso.datos;
        const tarjetas = MESAS_TORNEO.map((m, i) => this.tarjetaMesa(i, m, 250 + i * 390, 360, i + 1 > d.desbloqueada));
        const volver = crearBoton(this, ANCHO / 2, 616, 260, 54, TXT.volver, () => this.principal());
        this.sub.push(...tarjetas, volver);
        if (d.campeon) {
            const t = this.add.image(ANCHO / 2 + 250, 92, 'trofeo').setScale(0.36).setDepth(10);
            this.tweens.add({ targets: t, angle: { from: -6, to: 6 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.sub.push(t);
        }
        this.nav = navegacion(this, [...tarjetas, volver], { inicial: Math.min(d.desbloqueada, MESAS_TORNEO.length) - 1 });
        this.tecla('keydown-ESC', () => this.principal());
    }

    tarjetaMesa(i, m, x, y, bloqueada) {
        const W = 350, H = 400;
        const marco = this.add.nineslice(0, 0, 'panel', 0, W, H, 18, 18, 18, 18);
        const mesa = this.add.image(0, -104, Arte.mesa(this, m.tema)).setScale(0.25);
        const objs = [marco, mesa];
        const ids = m.rivales.map(([id]) => id);
        // En parejas, la compañera (la del medio) va aparte
        const rivales = ids.length === 3 ? [ids[0], ids[2]] : ids;
        rivales.forEach((id, k) => objs.push(this.add.image((k - (rivales.length - 1) / 2) * 92, -104, 'av_' + id, 0).setScale(0.62)));
        if (bloqueada) {
            objs.push(this.add.rectangle(0, 0, W - 8, H - 8, 0x000000, 0.55));
            objs.push(this.add.image(0, -104, 'candado').setScale(1.4));
        }
        const info = TXT.mesas[i];
        objs.push(this.add.text(0, 6, info.nombre, estiloTexto(30, ORO, { fontStyle: '700' })).setOrigin(0.5));
        objs.push(this.add.text(0, 52, bloqueada ? TXT.bloqueada : info.desc, estiloTexto(18, CREMA, { align: 'center', wordWrap: { width: W - 50 } })).setOrigin(0.5));
        objs.push(this.add.text(0, 100, `${TXT.niveles[m.rivales[0][1]]} · ${TXT.aPuntos(m.meta)}`, estiloTexto(18, '#d8cfbf')).setOrigin(0.5));
        Progreso.datos.estrellas[i].forEach((e, k) => objs.push(this.add.image((k - 1) * 60, 152, e ? 'estrella' : 'estrella_vacia').setScale(0.68)));
        if (bloqueada) objs.slice(-6).forEach((o) => o.setAlpha(0.6));
        const brillo = this.add.nineslice(0, 0, 'boton_oro', 0, W + 14, H + 14, 22, 22, 22, 22).setAlpha(0.9).setVisible(false);
        const c = this.add.container(x, y, [brillo, ...objs]).setSize(W, H).setDepth(10);
        c.setInteractive({ useHandCursor: true });
        c.resaltar = (si) => { brillo.setVisible(si); c.setScale(si ? 1.03 : 1); };
        c.pulsar = () => {
            Sonido.iniciar();
            if (bloqueada) {
                Sonido.sfx('error');
                this.tweens.add({ targets: c, x: x + 8, duration: 50, yoyo: true, repeat: 3 });
                return;
            }
            Sonido.sfx('elegir');
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Mesa', configTorneo(i)));
        };
        c.on('pointerdown', c.pulsar);
        return c;
    }

    /* ---------------- Partida rápida ---------------- */
    rapida() {
        this.limpiar();
        this.titulo(TXT.rapida);
        const o = Progreso.datos.rapida;
        this.sub.push(this.add.nineslice(ANCHO / 2, 330, 'panel', 0, 860, 330, 18, 18, 18, 18).setDepth(5));
        const filas = [
            { etiqueta: TXT.modo, clave: 'modo', valores: [4, 2], textos: [TXT.parejas, TXT.manoAMano] },
            { etiqueta: TXT.dificultad, clave: 'nivel', valores: [0, 1, 2], textos: TXT.niveles },
            { etiqueta: TXT.meta, clave: 'meta', valores: [50, 100, 150], textos: ['50', '100', '150'] },
            { etiqueta: TXT.mesa, clave: 'tema', valores: [0, 1, 2], textos: TXT.temas },
        ];
        let foco = 0;
        const flecha = this.add.text(0, 0, '▶', estiloTexto(24, ORO)).setOrigin(0.5).setDepth(12);
        this.sub.push(flecha);
        filas.forEach((f, r) => {
            const y = 210 + r * 72;
            f.y = y;
            f.texto = this.add.text(430, y, f.etiqueta, estiloTexto(26, CREMA)).setOrigin(1, 0.5).setDepth(10);
            this.sub.push(f.texto);
            f.botones = f.valores.map((v, k) => {
                const b = crearBoton(this, 540 + k * 180, y, 166, 50, f.textos[k], () => { o[f.clave] = v; pintar(); foco = r; marcar(); }, { tam: 21 });
                this.sub.push(b);
                return b;
            });
        });
        const jugar = crearBoton(this, ANCHO / 2 - 150, 560, 280, 58, TXT.jugar, () => {
            Progreso.guardar();
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Mesa', configRapida(o)));
        });
        const volver = crearBoton(this, ANCHO / 2 + 150, 560, 240, 58, TXT.volver, () => { Progreso.guardar(); this.principal(); });
        this.sub.push(jugar, volver);
        const pintar = () => filas.forEach((f) => f.botones.forEach((b, k) => b.resaltar(f.valores[k] === o[f.clave])));
        const marcar = () => {
            filas.forEach((f, r) => f.texto.setColor(r === foco ? ORO : CREMA));
            jugar.setScale(foco === 4 ? 1.06 : 1); volver.setScale(foco === 5 ? 1.06 : 1);
            if (foco < 4) flecha.setVisible(true).setPosition(filas[foco].texto.x - filas[foco].texto.width - 26, filas[foco].y);
            else flecha.setVisible(true).setPosition(foco === 4 ? jugar.x - 168 : volver.x - 148, 560);
        };
        const cambiar = (d) => {
            if (foco >= 4) { foco = foco === 4 ? 5 : 4; marcar(); Sonido.sfx('menu'); return; }
            const f = filas[foco];
            const k = (f.valores.indexOf(o[f.clave]) + d + f.valores.length) % f.valores.length;
            o[f.clave] = f.valores[k];
            pintar(); Sonido.sfx('menu');
        };
        this.tecla('keydown-UP', () => { foco = (foco + 5) % 6; marcar(); Sonido.sfx('menu'); });
        this.tecla('keydown-DOWN', () => { foco = (foco + 1) % 6; marcar(); Sonido.sfx('menu'); });
        this.tecla('keydown-LEFT', () => cambiar(-1));
        this.tecla('keydown-RIGHT', () => cambiar(1));
        const ok = () => { if (foco === 4) jugar.pulsar(); else if (foco === 5) volver.pulsar(); else { foco++; marcar(); } };
        this.tecla('keydown-ENTER', ok);
        this.tecla('keydown-SPACE', ok);
        this.tecla('keydown-ESC', () => volver.pulsar());
        pintar();
        marcar();
    }

    /* ---------------- Reglas ---------------- */
    reglas() {
        this.limpiar();
        this.titulo(TXT.reglas, 76, 54);
        this.sub.push(this.add.nineslice(ANCHO / 2, 350, 'panel', 0, 1060, 470, 18, 18, 18, 18).setDepth(5));
        TXT.textoReglas.forEach((linea, i) => {
            const y = 146 + i * 45;
            this.sub.push(this.add.image(146, y + 2, 'chip').setScale(0.5).setDepth(10));
            this.sub.push(this.add.text(146, y, String(i + 1), estiloTexto(15, ORO, { strokeThickness: 0 })).setOrigin(0.5).setDepth(11));
            this.sub.push(this.add.text(172, y, linea, estiloTexto(19, CREMA, { strokeThickness: 3, wordWrap: { width: 920 } })).setOrigin(0, 0.5).setDepth(10));
        });
        this.sub.push(this.add.text(ANCHO / 2, 556, TXT.textoControles, estiloTexto(17, ORO, { strokeThickness: 3 })).setOrigin(0.5).setDepth(10));
        const volver = crearBoton(this, ANCHO / 2, 626, 260, 54, TXT.volver, () => this.principal());
        this.sub.push(volver);
        this.nav = navegacion(this, [volver]);
        this.tecla('keydown-ESC', () => this.principal());
    }
}

/* ===================================================================== */
class Pausa extends Phaser.Scene {
    constructor() { super('Pausa'); }

    create() {
        this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.6).setOrigin(0).setInteractive();
        this.add.nineslice(ANCHO / 2, ALTO / 2, 'panel', 0, 460, 420, 18, 18, 18, 18);
        this.add.text(ANCHO / 2, ALTO / 2 - 160, TXT.pausa, estiloTexto(48, ORO, { fontStyle: '700' })).setOrigin(0.5);
        const items = [
            [TXT.reanudar, () => this.reanudar()],
            [Sonido.activo ? TXT.sonidoSi : TXT.sonidoNo, (b) => b.texto.setText(Sonido.alternar() ? TXT.sonidoSi : TXT.sonidoNo)],
            [Sonido.musicaActiva ? TXT.musicaSi : TXT.musicaNo, (b) => b.texto.setText(Sonido.alternarMusica() ? TXT.musicaSi : TXT.musicaNo)],
            [TXT.abandonar, () => { this.scene.stop('Mesa'); this.scene.start('Menu'); }],
        ];
        const botones = items.map(([t, f], i) => {
            const b = crearBoton(this, ANCHO / 2, ALTO / 2 - 72 + i * 70, 340, 56, t, () => f(b), { tam: 24 });
            return b;
        });
        this.nav = navegacion(this, botones);
        this.input.keyboard.on('keydown-ESC', () => this.reanudar());
        this.input.keyboard.on('keydown-P', () => this.reanudar());
    }

    reanudar() {
        this.scene.stop();
        this.scene.resume('Mesa');
    }
}
