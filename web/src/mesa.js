/* La mesa de dominó: reparte, lleva los turnos, anima cada ficha y enseña el resumen de cada
   ronda y el final de la partida. Las reglas están en motor.js y la computadora en ia.js. */

const NOMBRES = { pedro: 'Pedro', lucia: 'Lucía', andres: 'Andrés', ramon: 'Don Ramón', carmen: 'Carmen' };
const MESAS_TORNEO = [
    { tema: 0, meta: 50, rivales: [['pedro', NIVELES.FACIL]] },
    { tema: 1, meta: 75, rivales: [['pedro', NIVELES.NORMAL], ['lucia', NIVELES.NORMAL], ['andres', NIVELES.NORMAL]] },
    { tema: 2, meta: 100, rivales: [['ramon', NIVELES.EXPERTO], ['lucia', NIVELES.EXPERTO], ['carmen', NIVELES.EXPERTO]] },
];

const AREA_MESA = new Rect(178, 126, 924, 366);
const Y_MANO = 626;
const ESC_MANO = 0.58;
const ESC_OCULTA = 0.27;
const LUGARES = { 4: ['abajo', 'derecha', 'arriba', 'izquierda'], 2: ['abajo', 'arriba'] };
const SITIOS = {
    abajo: { av: [100, 622], nombre: [100, 680], globo: [100, 540] },
    arriba: { av: [560, 74], nombre: [506, 74], fichas: { x: 624, y: 74, dx: 30, dy: 0, angulo: 0, max: 440 }, globo: [560, 152] },
    izquierda: { av: [92, 200], nombre: [92, 256], fichas: { x: 92, y: 304, dx: 0, dy: 29, angulo: 90, max: 180 }, globo: [168, 200] },
    derecha: { av: [1188, 200], nombre: [1188, 256], fichas: { x: 1188, y: 304, dx: 0, dy: 29, angulo: 90, max: 180 }, globo: [1112, 200] },
};
const POZO = { x: 1188, y: 330 };

/** Ángulo destino por el camino más corto. */
function anguloCercano(desde, hasta) {
    const d = ((hasta - desde + 540) % 360 + 360) % 360 - 180;
    return desde + d;
}

class Mesa extends Phaser.Scene {
    constructor() { super('Mesa'); }

    init(cfg) {
        this.cfg = cfg;
        const q = new URLSearchParams(location.search);
        this.auto = q.has('auto');
        this.velocidad = Math.max(1, parseFloat(q.get('vel')) || 1);
    }

    create() {
        // Phaser reutiliza el objeto de la escena al reiniciarla: nada de la partida anterior debe quedar
        Object.assign(this, {
            capaObjs: [], nav: null, brilloCursor: null, pistaImg: null, ultimaImg: null, teclado: false, ladoTeclado: null,
            arrastre: null, finArrastre: 0, resolver: null, disp: null, txtPozo: null, txtPozoN: null,
        });
        this.vivo = true;
        this.events.once('shutdown', () => { this.vivo = false; });
        this.time.timeScale = this.velocidad;
        this.tweens.timeScale = this.velocidad;
        this.cameras.main.fadeIn(400, 0, 0, 0);
        const tema = TEMAS[this.cfg.tema];
        this.tema = tema;
        this.add.image(0, 0, Arte.mesa(this, this.cfg.tema)).setOrigin(0).setDepth(-10);

        const jugadores = [{ nombre: TXT.tu, avatar: 'tu', humano: true }];
        for (const [id, nivel] of this.cfg.rivales) jugadores.push({ nombre: NOMBRES[id], avatar: id, nivel });
        this.partida = new PartidaDomino(jugadores, this.cfg.meta);
        this.lugares = LUGARES[jugadores.length];

        this.conSombra = new Set();
        this.fichasMesa = new Map();
        this.mano = [];          // imágenes de tus fichas, en el orden de la mano
        this.reversos = this.partida.jugadores.map(() => []);
        this.pozoImgs = [];
        this.seleccionada = null;
        this.cursor = 0;
        this.esperandoHumano = false;

        this.crearAsientos();
        this.crearMarcador();
        this.crearControles();
        this.crearExtremos();
        this.emPolvo = this.add.particles(0, 0, 'polvo', {
            speed: { min: 30, max: 90 }, scale: { start: 0.6, end: 1.4 }, alpha: { start: 0.5, end: 0 },
            lifespan: 500, emitting: false, tint: 0xfff3d6,
        }).setDepth(30);
        this.emChispas = this.add.particles(0, 0, 'chispa', {
            speed: { min: 80, max: 260 }, scale: { start: 0.9, end: 0 }, lifespan: 700, emitting: false, tint: [0xffd25e, 0xffffff, 0xffb347],
        }).setDepth(85);
        this.mensajeFondo = this.add.nineslice(ANCHO / 2, 532, 'panel', 0, 300, 44, 18, 18, 18, 18).setDepth(45).setAlpha(0.9);
        this.mensajeTexto = this.add.text(ANCHO / 2, 531, '', estiloTexto(22, CREMA)).setOrigin(0.5).setDepth(46);

        const alReanudar = () => this.botonSonido.icono.setTexture(Sonido.activo ? 'ic_sonido' : 'ic_mudo');
        this.events.on('resume', alReanudar);
        this.events.once('shutdown', () => this.events.off('resume', alReanudar));
        Sonido.musica(tema.musica);
        this.empezarRonda();
    }

    update() {
        for (const img of this.conSombra) {
            if (!img.active) { img.sombra.destroy(); this.conSombra.delete(img); continue; }
            const s = img.sombra, k = Math.abs(img.scaleY), alt = img.altura || 0;
            s.setPosition(img.x + (5 + 16 * alt) * k, img.y + (8 + 26 * alt) * k).setAngle(img.angle)
                .setScale(img.scaleX, img.scaleY).setDepth(img.depth - 0.5).setVisible(img.visible).setAlpha((0.32 - 0.12 * alt) * img.alpha);
        }
        if (this.ultimaImg && this.ultimaImg.active) {
            this.brillo.setPosition(this.ultimaImg.x, this.ultimaImg.y).setAngle(this.ultimaImg.angle).setScale(this.ultimaImg.scaleX, this.ultimaImg.scaleY).setDepth(this.ultimaImg.depth - 0.2);
        }
    }

    /* ------------------------------------------------------------------ montaje */

    nuevaFicha(textura, x, y, escala, prof = 20) {
        const img = this.add.image(x, y, textura).setScale(escala).setDepth(prof);
        img.altura = 0;
        img.sombra = this.add.image(x, y, 'sombra_ficha').setAlpha(0.3).setDepth(prof - 0.5);
        this.conSombra.add(img);
        return img;
    }

    crearAsientos() {
        this.asientos = this.partida.jugadores.map((j, i) => {
            const sitio = SITIOS[this.lugares[i]];
            const [ax, ay] = sitio.av;
            const anillo = this.add.image(ax, ay, 'anillo').setScale(0.62).setTint(0xffd25e).setAlpha(0).setDepth(5);
            const av = this.add.image(ax, ay, 'av_' + j.avatar, 0).setScale(0.62).setDepth(6);
            const [nx, ny] = sitio.nombre;
            const arriba = this.lugares[i] === 'arriba';
            const companera = this.partida.enParejas && i === 2;
            const t = this.add.text(nx, ny - (companera ? 10 : 0), j.nombre, estiloTexto(18, CREMA)).setOrigin(arriba ? 1 : 0.5, 0.5).setDepth(6);
            if (companera) this.add.text(nx, ny + 12, TXT.companera, estiloTexto(14, '#bfe8c8', { strokeThickness: 3 })).setOrigin(1, 0.5).setDepth(6);
            return { sitio, anillo, av, nombreTxt: t, globo: null };
        });
        this.brillo = this.add.image(0, 0, 'brillo').setTint(0xffd25e).setAlpha(0).setDepth(9);
        this.tweens.add({ targets: this.brillo, alpha: { from: 0.55, to: 0.95 }, duration: 700, yoyo: true, repeat: -1, paused: true });
    }

    crearMarcador() {
        const x = 46, y = 42;
        this.add.nineslice(x, y, 'panel', 0, 300, 92, 18, 18, 18, 18).setOrigin(0).setDepth(40);
        this.txtRonda = this.add.text(x + 16, y + 10, '', estiloTexto(16, ORO, { strokeThickness: 3 })).setDepth(41);
        const p = this.partida;
        const nombres = p.enParejas ? [TXT.nosotros, TXT.ellos] : [TXT.tu, p.jugadores[1].nombre];
        this.filasMarcador = nombres.map((n, e) => {
            const fy = y + 42 + e * 26;
            const nombre = this.add.text(x + 16, fy, n, estiloTexto(18, CREMA, { strokeThickness: 3 })).setOrigin(0, 0.5).setDepth(41);
            this.add.rectangle(x + 130, fy, 110, 10, 0x000000, 0.45).setOrigin(0, 0.5).setDepth(41);
            const barra = this.add.rectangle(x + 130, fy, 0, 10, e === 0 ? 0x7dff9a : 0xff8a7a).setOrigin(0, 0.5).setDepth(42);
            const pts = this.add.text(x + 284, fy, '0', estiloTexto(20, ORO, { strokeThickness: 3 })).setOrigin(1, 0.5).setDepth(41);
            return { nombre, barra, pts, valor: 0 };
        });
    }

    actualizarMarcador(animarPuntos = false) {
        const p = this.partida;
        this.txtRonda.setText(`${TXT.ronda(p.ronda)} · ${TXT.aPuntos(p.meta)}`);
        this.filasMarcador.forEach((f, e) => {
            const destino = p.puntos[e];
            const ancho = 110 * Math.min(1, destino / p.meta);
            if (!animarPuntos || destino === f.valor) {
                f.valor = destino; f.pts.setText(String(destino)); f.barra.width = ancho;
                return;
            }
            this.tweens.addCounter({
                from: f.valor, to: destino, duration: 900, ease: 'Quad.easeOut',
                onUpdate: (tw) => { const v = Math.round(tw.getValue()); if (String(v) !== f.pts.text) { f.pts.setText(String(v)); Sonido.sfx('puntos'); } },
            });
            this.tweens.add({ targets: f.barra, width: ancho, duration: 900, ease: 'Quad.easeOut' });
            this.tweens.add({ targets: f.pts, scale: 1.35, duration: 200, yoyo: true, repeat: 1 });
            f.valor = destino;
        });
    }

    crearControles() {
        this.botonSonido = crearBotonIcono(this, 1150, 66, Sonido.activo ? 'ic_sonido' : 'ic_mudo', (b) => {
            b.icono.setTexture(Sonido.alternar() ? 'ic_sonido' : 'ic_mudo');
        });
        crearBotonIcono(this, 1214, 66, 'ic_pausa', () => this.pausar());
        this.botonPista = crearBotonIcono(this, 1188, 618, 'ic_pista', () => this.darPista());
        this.add.text(1188, 658, TXT.pista, estiloTexto(16, CREMA)).setOrigin(0.5).setDepth(60);
        if (!this.partida.enParejas) {
            this.txtPozo = this.add.text(POZO.x, POZO.y - 70, TXT.pozo, estiloTexto(18, CREMA)).setOrigin(0.5).setDepth(6);
            this.txtPozoN = this.add.text(POZO.x, POZO.y + 72, '', estiloTexto(20, ORO)).setOrigin(0.5).setDepth(6);
        }
        const tk = this.input.keyboard;
        tk.on('keydown', () => Sonido.iniciar());
        tk.on('keydown-LEFT', () => this.teclaLado(-1));
        tk.on('keydown-RIGHT', () => this.teclaLado(1));
        tk.on('keydown-A', () => this.teclaLado(-1));
        tk.on('keydown-D', () => this.teclaLado(1));
        for (const k of ['ENTER', 'SPACE', 'UP', 'W']) tk.on('keydown-' + k, () => this.teclaJugar());
        tk.on('keydown-DOWN', () => this.cancelarSeleccion());
        tk.on('keydown-H', () => this.darPista());
        tk.on('keydown-M', () => this.botonSonido.icono.setTexture(Sonido.alternar() ? 'ic_sonido' : 'ic_mudo'));
        tk.on('keydown-ESC', () => { if (this.seleccionada) this.cancelarSeleccion(); else this.pausar(); });
        tk.on('keydown-P', () => this.pausar());
        this.input.on('pointerdown', () => Sonido.iniciar());
        this.input.dragDistanceThreshold = 8;
    }

    /** Los números de los dos extremos de la mesa y los huecos dorados donde puede ir tu ficha. */
    crearExtremos() {
        this.chips = {};
        for (const lado of [IZQ, DER]) {
            const img = this.add.image(0, 0, 'chip').setScale(0.8);
            const t = this.add.text(0, -1, '', estiloTexto(22, ORO, { strokeThickness: 0 })).setOrigin(0.5);
            this.chips[lado] = this.add.container(0, 0, [img, t]).setDepth(35).setVisible(false);
            this.chips[lado].texto = t;
        }
        this.huecos = {};
        for (const lado of [IZQ, DER, CENTRO]) {
            const h = this.add.image(0, 0, 'hueco').setTint(0xffd25e).setDepth(34).setVisible(false);
            h.setInteractive(new Phaser.Geom.Rectangle(-30, -30, TEX_W + 60, TEX_H + 60), Phaser.Geom.Rectangle.Contains);
            h.on('pointerdown', () => { if (this.seleccionada && h.visible) this.resolverHumano([this.seleccionada.ficha, lado]); });
            this.huecos[lado] = h;
        }
        this.tweens.add({ targets: Object.values(this.huecos), alpha: { from: 0.45, to: 1 }, duration: 520, yoyo: true, repeat: -1 });
    }

    /* ------------------------------------------------------------------ mesa */

    destinoMesa(disp, f) {
        const e = disp.fichas.find((d) => d.ficha === f);
        const largo = Math.max(e.rect.w, e.rect.h);
        return { x: e.rect.centerx, y: e.rect.centery, angle: anguloFicha(f, e.numeros, e.vertical), escala: (largo - 3) / TEX_H };
    }

    /** Mueve las fichas de la mesa a su sitio (cambia al crecer la serpiente o encoger las fichas). */
    recolocarMesa(dur = 320, excepto = null) {
        this.disp = disponer(this.partida.mesa, AREA_MESA);
        for (const [f, img] of this.fichasMesa) {
            if (f === excepto) continue;
            const d = this.destinoMesa(this.disp, f);
            const angulo = anguloCercano(img.angle, d.angle);
            if (Math.abs(img.x - d.x) < 0.5 && Math.abs(img.y - d.y) < 0.5 && Math.abs(img.scaleY - d.escala) < 0.002 && Math.abs(img.angle - angulo) < 0.5) continue;
            this.tweens.add({ targets: img, x: d.x, y: d.y, angle: angulo, scaleX: d.escala, scaleY: d.escala, duration: dur, ease: 'Cubic.easeInOut' });
        }
        this.actualizarExtremos();
    }

    actualizarExtremos() {
        const m = this.partida.mesa;
        const activa = !m.vacia && !this.partida.rondaTerminada;
        for (const lado of [IZQ, DER]) {
            const c = this.chips[lado];
            if (!activa || !this.disp) { c.setVisible(false); continue; }
            const r = this.disp.huecos[lado];
            c.texto.setText(String(m.extremo(lado)));
            c.setPosition(r.centerx, r.centery).setVisible(!this.huecos[lado].visible);
        }
    }

    mostrarHuecos(lados, destacado = null) {
        for (const lado of [IZQ, DER, CENTRO]) {
            const h = this.huecos[lado];
            if (!lados.includes(lado) || !this.disp || !this.disp.huecos[lado]) { h.setVisible(false); continue; }
            const r = this.disp.huecos[lado];
            const horizontal = r.w > r.h;
            h.setPosition(r.centerx, r.centery).setAngle(horizontal ? 90 : 0).setScale((Math.max(r.w, r.h) - 3) / TEX_H).setVisible(true);
            h.setTint(destacado === lado ? 0xffffff : 0xffd25e);
        }
        this.actualizarExtremos();
    }

    marcarUltima(img) {
        this.ultimaImg = img;
        const tw = this.tweens.getTweensOf(this.brillo)[0];
        if (tw) tw.resume();
        this.brillo.setVisible(true);
    }

    /* ------------------------------------------------------------------ ronda */

    async empezarRonda() {
        const p = this.partida;
        this.limpiarRonda();
        this.actualizarMarcador();
        this.disp = disponer(p.mesa, AREA_MESA);
        grito(this, TXT.ronda(p.ronda), { tam: 64, color: CREMA, dura: 900, y: AREA_MESA.centery - 10 });
        await esperar(this, 700);
        if (!this.vivo) return;
        await this.animarReparto();
        if (!this.vivo) return;
        const abre = p.jugadores[p.turno];
        if (p.fichaObligada) this.mensaje(abre.humano ? TXT.salesTu(nombreFicha(p.fichaObligada)) : TXT.sale(abre.nombre, nombreFicha(p.fichaObligada)));
        else this.mensaje(abre.humano ? TXT.abresTu : TXT.abre(abre.nombre));
        await esperar(this, 900);
        this.bucleTurnos();
    }

    limpiarRonda() {
        for (const img of [...this.fichasMesa.values(), ...this.mano, ...this.reversos.flat(), ...this.pozoImgs]) img.destroy();
        this.fichasMesa.clear();
        this.mano = [];
        this.reversos = this.partida.jugadores.map(() => []);
        this.pozoImgs = [];
        this.ultimaImg = null;
        this.brillo.setVisible(false);
        this.seleccionada = null;
        for (const h of Object.values(this.huecos)) h.setVisible(false);
        for (const c of Object.values(this.chips)) c.setVisible(false);
        this.asientos.forEach((a) => a.av.setFrame(0));
        if (this.txtPozoN) this.txtPozoN.setText('');
    }

    /** Dónde va cada ficha oculta de un jugador (o la de tu mano). */
    sitioOculta(i, k, n) {
        const f = this.asientos[i].sitio.fichas;
        const paso = n > 1 ? Math.min(f.dx || f.dy, f.max / (n - 1)) : 0;
        if (f.dx) return { x: f.x + k * paso, y: f.y, angle: f.angulo };
        const total = paso * (n - 1);
        return { x: f.x, y: f.y + k * paso - (n > 7 ? total / 2 - 90 : 0), angle: f.angulo };
    }

    sitioMano(k, n) {
        const paso = n > 1 ? Math.min(64, 860 / (n - 1)) : 0;
        return { x: ANCHO / 2 - (paso * (n - 1)) / 2 + k * paso, y: Y_MANO };
    }

    sitioPozo(k) { return { x: POZO.x + (k % 2) * 3 - 1, y: POZO.y + 40 - k * 5, angle: 90 }; }

    async animarReparto() {
        const p = this.partida;
        const tinte = this.tema.reverso;
        const [cx, cy] = AREA_MESA.center;
        const pila = [];
        for (let k = 0; k < 28; k++) {
            const img = this.nuevaFicha('reverso', cx + Phaser.Math.Between(-6, 6), cy - 200 - k * 2, ESC_OCULTA * 1.2, 20 + k * 0.01).setTint(tinte).setAngle(Phaser.Math.Between(-20, 20));
            img.setAlpha(0);
            pila.push(img);
        }
        // Caen al centro y se revuelven
        Sonido.sfx('barajar');
        pila.forEach((img, k) => this.tweens.add({ targets: img, alpha: 1, y: cy + Phaser.Math.Between(-10, 10), duration: 260, delay: k * 8, ease: 'Quad.easeIn' }));
        await esperar(this, 360);
        for (let vuelta = 0; vuelta < 2; vuelta++) {
            pila.forEach((img) => this.tweens.add({
                targets: img, x: Phaser.Math.Between(AREA_MESA.left + 140, AREA_MESA.right - 140), y: Phaser.Math.Between(AREA_MESA.top + 40, AREA_MESA.bottom - 40),
                angle: Phaser.Math.Between(-180, 180), duration: 340, ease: 'Sine.easeInOut',
            }));
            await esperar(this, 380);
            if (vuelta === 0) Sonido.sfx('barajar');
        }
        // Reparte: 7 a cada uno y el resto al pozo
        const n = p.numJugadores;
        let k = 0;
        const vuelos = [];
        for (let ronda = 0; ronda < 7; ronda++) {
            for (let i = 0; i < n; i++) {
                const img = pila[k++];
                let d;
                if (i === 0) d = Object.assign(this.sitioMano(ronda, 7), { angle: 0, escala: ESC_MANO });
                else d = Object.assign(this.sitioOculta(i, ronda, 7), { escala: ESC_OCULTA });
                if (i === 0) this.mano.push(img); else this.reversos[i].push(img);
                img.setDepth(i === 0 ? 50 + ronda : 8 + ronda * 0.01);
                vuelos.push([img, d]);
            }
        }
        for (let r = 0; k < 28; r++) {
            const img = pila[k++];
            this.pozoImgs.push(img);
            img.setDepth(7 + r * 0.01);
            vuelos.push([img, Object.assign(this.sitioPozo(r), { escala: ESC_OCULTA })]);
        }
        vuelos.forEach(([img, d], j) => {
            img.altura = 1;
            this.tweens.add({
                targets: img, x: d.x, y: d.y, angle: anguloCercano(img.angle, d.angle), scaleX: d.escala, scaleY: d.escala, altura: 0,
                duration: 300, delay: j * 26, ease: 'Cubic.easeOut', onStart: () => { if (j % 3 === 0) Sonido.sfx('repartir'); },
            });
        });
        await esperar(this, vuelos.length * 26 + 320);
        if (this.txtPozoN) this.txtPozoN.setText(String(p.pozo.length));
        // Tus fichas se dan la vuelta
        p.jugadores[0].mano.forEach((f, j) => {
            const img = this.mano[j];
            img.ficha = f;
            this.prepararFichaMano(img);
            this.voltear(img, `ficha_${f.a}${f.b}`, j * 55);
        });
        await esperar(this, 7 * 55 + 260);
        this.refrescarMano();
    }

    /** Da la vuelta a una ficha (encoge, cambia de cara y vuelve). */
    voltear(img, textura, retardo = 0) {
        const sx = img.scaleX;
        this.tweens.add({
            targets: img, scaleX: 0, duration: 110, delay: retardo, ease: 'Quad.easeIn',
            onComplete: () => {
                img.setTexture(textura).clearTint();
                Sonido.sfx('girar');
                this.tweens.add({ targets: img, scaleX: sx, duration: 130, ease: 'Quad.easeOut' });
            },
        });
    }

    /* ------------------------------------------------------------------ turnos */

    async bucleTurnos() {
        const p = this.partida;
        while (this.vivo && !p.rondaTerminada) {
            const i = p.turno;
            const j = p.jugadores[i];
            this.marcarTurno(i);
            if (j.humano && !this.auto) {
                if (p.debeRobar()) {
                    this.mensaje(TXT.robas);
                    await esperar(this, 650);
                    if (!this.vivo) return;
                    const f = p.robar();
                    await this.animarRobo(0, f);
                    continue;
                }
                if (p.debePasar()) {
                    this.mensaje(TXT.noLlevas);
                    await esperar(this, 700);
                    if (!this.vivo) return;
                    p.pasar();
                    this.alPasar(0);
                    await esperar(this, 1000);
                    continue;
                }
                this.mensaje(p.fichaObligada ? TXT.salesTu(nombreFicha(p.fichaObligada)) : TXT.tuTurno);
                Sonido.sfx('turno');
                const [f, lado] = await this.esperarHumano();
                if (!this.vivo) return;
                const img = this.mano.find((m) => m.ficha === f);
                this.mano.splice(this.mano.indexOf(img), 1);
                img.disableInteractive();
                p.jugar(f, lado);
                this.refrescarMano();
                await this.animarJugada(0, f, img);
            } else {
                this.mensaje(TXT.juega(j.nombre));
                if (!j.humano) this.pensando(i, true);
                await esperar(this, j.humano ? 350 : [700, 850, 1050][j.nivel]);
                if (!this.vivo) return;
                this.pensando(i, false);
                const jugada = IA.elegir(p, j.humano ? NIVELES.NORMAL : j.nivel);
                if (jugada) {
                    p.jugar(jugada[0], jugada[1]);
                    let img;
                    if (i === 0) {
                        img = this.mano.find((m) => m.ficha === jugada[0]);
                        this.mano.splice(this.mano.indexOf(img), 1);
                        img.disableInteractive();
                        this.refrescarMano();
                    } else {
                        img = this.sacarOculta(i, jugada[0]);
                    }
                    await this.animarJugada(i, jugada[0], img);
                    if (!p.rondaTerminada && esDoble(jugada[0]) && Math.random() < 0.4) this.decir(i, TXT.doble, 1);
                } else if (p.debeRobar()) {
                    const f = p.robar();
                    this.decir(i, TXT.roba, 0, 700);
                    await this.animarRobo(i, f);
                } else {
                    p.pasar();
                    this.alPasar(i);
                    await esperar(this, 1000);
                }
            }
        }
        if (this.vivo) this.finRonda();
    }

    marcarTurno(i) {
        this.asientos.forEach((a, k) => {
            this.tweens.killTweensOf(a.anillo);
            if (k === i) {
                a.anillo.setAlpha(1).setScale(0.62);
                this.tweens.add({ targets: a.anillo, scale: 0.7, alpha: 0.55, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                a.nombreTxt.setColor(ORO);
            } else {
                a.anillo.setAlpha(0);
                a.nombreTxt.setColor(CREMA);
            }
        });
    }

    /** Quita una ficha oculta del jugador y la convierte en la ficha que juega, boca arriba. */
    sacarOculta(i, f) {
        const lista = this.reversos[i];
        const atras = lista.splice(Math.floor(lista.length / 2), 1)[0];
        const img = this.nuevaFicha(`ficha_${f.a}${f.b}`, atras.x, atras.y, ESC_OCULTA, 40).setAngle(atras.angle);
        atras.destroy();
        // Las que quedan se juntan
        lista.forEach((r, k) => {
            const d = this.sitioOculta(i, k, lista.length);
            this.tweens.add({ targets: r, x: d.x, y: d.y, duration: 220 });
        });
        return img;
    }

    async animarJugada(i, f, img) {
        const p = this.partida;
        this.disp = disponer(p.mesa, AREA_MESA);
        const d = this.destinoMesa(this.disp, f);
        this.recolocarMesa(380, f);
        this.fichasMesa.set(f, img);
        img.setDepth(60);
        img.altura = 1;
        await animar(this, {
            targets: img, x: d.x, y: d.y - 10, angle: anguloCercano(img.angle, d.angle),
            scaleX: d.escala * 1.14, scaleY: d.escala * 1.14, altura: 0.6, duration: 360, ease: 'Cubic.easeOut',
        });
        if (!this.vivo) return;
        await animar(this, { targets: img, y: d.y, scaleX: d.escala, scaleY: d.escala, altura: 0, duration: 100, ease: 'Quad.easeIn' });
        if (!this.vivo) return;
        img.setDepth(10 + this.fichasMesa.size * 0.01);
        const doble = esDoble(f);
        Sonido.sfx(doble ? 'doble' : 'ficha');
        this.emPolvo.explode(doble ? 10 : 6, d.x, d.y);
        if (doble) this.cameras.main.shake(120, 0.003);
        this.marcarUltima(img);
        this.actualizarExtremos();
    }

    async animarRobo(i, f) {
        const img = this.pozoImgs.pop();
        if (this.txtPozoN) this.txtPozoN.setText(String(this.partida.pozo.length));
        Sonido.sfx('robar');
        img.setDepth(60);
        img.altura = 1;
        if (i === 0) {
            img.ficha = f;
            const k = this.partida.jugadores[0].mano.indexOf(f);
            this.mano.splice(k, 0, img);
            this.prepararFichaMano(img);
            const d = this.sitioMano(k, this.mano.length);
            this.refrescarMano(img);
            await animar(this, { targets: img, x: d.x, y: d.y - 20, angle: 0, scaleX: ESC_MANO, scaleY: ESC_MANO, altura: 0, duration: 380, ease: 'Cubic.easeOut' });
            if (!this.vivo) return;
            this.voltear(img, `ficha_${f.a}${f.b}`);
            await esperar(this, 260);
            this.refrescarMano();
        } else {
            const lista = this.reversos[i];
            lista.push(img);
            const d = this.sitioOculta(i, lista.length - 1, lista.length);
            lista.forEach((r, k) => {
                const dk = this.sitioOculta(i, k, lista.length);
                if (r !== img) this.tweens.add({ targets: r, x: dk.x, y: dk.y, duration: 200 });
            });
            await animar(this, { targets: img, x: d.x, y: d.y, angle: anguloCercano(img.angle, d.angle), altura: 0, duration: 360, ease: 'Cubic.easeOut' });
            img.setDepth(8 + lista.length * 0.01);
        }
        await esperar(this, 120);
    }

    alPasar(i) {
        Sonido.sfx('paso');
        this.decir(i, TXT.paso, 2, 1100);
        for (const c of Object.values(this.chips)) if (c.visible) this.tweens.add({ targets: c, scale: 1.3, duration: 120, yoyo: true });
    }

    /* ------------------------------------------------------------------ bocadillos */

    decir(i, texto, cara = 0, dura = 1200) {
        const a = this.asientos[i];
        if (a.globo) a.globo.destroy();
        const [gx, gy] = a.sitio.globo;
        const t = this.add.text(0, 0, texto, estiloTexto(20, TINTA, { strokeThickness: 0 })).setOrigin(0.5);
        const w = Math.max(70, t.width + 30);
        const fondo = this.add.nineslice(0, 0, 'globo', 0, w, 44, 18, 18, 18, 18);
        const lugar = this.lugares[i];
        const ox = lugar === 'izquierda' ? w / 2 : lugar === 'derecha' ? -w / 2 : 0;
        a.globo = this.add.container(gx + ox, gy, [fondo, t]).setDepth(70).setScale(0.3);
        this.tweens.add({ targets: a.globo, scale: 1, duration: 220, ease: 'Back.easeOut' });
        const globo = a.globo;
        this.time.delayedCall(dura, () => {
            if (!globo.active) return;
            this.tweens.add({ targets: globo, alpha: 0, scale: 0.8, duration: 200, onComplete: () => globo.destroy() });
        });
        if (cara) {
            a.av.setFrame(cara);
            this.time.delayedCall(dura + 300, () => a.av.active && !this.partida.rondaTerminada && a.av.setFrame(0));
        }
    }

    pensando(i, si) {
        const a = this.asientos[i];
        if (a.pensando) { a.pensando.destroy(); a.pensando = null; }
        if (!si) return;
        const [gx, gy] = a.sitio.globo;
        const lugar = this.lugares[i];
        const ox = lugar === 'izquierda' ? 40 : lugar === 'derecha' ? -40 : 0;
        const fondo = this.add.nineslice(0, 0, 'globo', 0, 76, 40, 18, 18, 18, 18);
        const puntos = [-18, 0, 18].map((x) => this.add.circle(x, 0, 5, 0x3a2a18));
        a.pensando = this.add.container(gx + ox, gy, [fondo, ...puntos]).setDepth(69);
        puntos.forEach((pt, k) => this.tweens.add({ targets: pt, y: -6, duration: 260, yoyo: true, repeat: -1, delay: k * 120, ease: 'Sine.easeInOut' }));
    }

    mensaje(texto, color = CREMA) {
        this.mensajeTexto.setText(texto).setColor(color);
        this.mensajeFondo.width = Math.max(260, this.mensajeTexto.width + 46);
        this.mensajeFondo.setVisible(!!texto);
    }

    /* ------------------------------------------------------------------ tu mano */

    prepararFichaMano(img) {
        img.setInteractive({ useHandCursor: true, draggable: true });
        img.on('pointerover', () => { img.encima = true; this.refrescarMano(); });
        img.on('pointerout', () => { img.encima = false; this.refrescarMano(); });
        img.on('pointerup', () => {
            // Tras soltar un arrastre a veces llega también el "pointerup": no es un toque
            if (performance.now() - (this.finArrastre || 0) < 250) return;
            this.tocarFicha(img);
        });
        img.on('dragstart', () => {
            if (!this.puedeElegir() || !this.ladosDe(img.ficha).length) { this.arrastre = null; return; }
            this.arrastre = img;
            this.seleccionada = null;
            img.setDepth(80);
            img.altura = 1;
            this.mostrarHuecos(this.ladosDe(img.ficha));
            Sonido.sfx('levantar');
        });
        img.on('drag', (pt, x, y) => {
            if (this.arrastre !== img) return;
            img.setPosition(x, y);
            const cerca = this.huecoCercano(img);
            this.mostrarHuecos(this.ladosDe(img.ficha), cerca);
        });
        img.on('dragend', () => {
            if (this.arrastre !== img) return;
            this.finArrastre = performance.now();
            this.arrastre = null;
            img.altura = 0;
            const cerca = this.huecoCercano(img);
            if (cerca) { this.resolverHumano([img.ficha, cerca]); return; }
            this.mostrarHuecos([]);
            this.refrescarMano();
        });
    }

    ladosDe(f) {
        return this.partida.jugadasValidas(0).filter(([g]) => g === f).map(([, l]) => l);
    }

    huecoCercano(img) {
        let mejor = null, dist = 170;
        for (const lado of this.ladosDe(img.ficha)) {
            const r = this.disp && this.disp.huecos[lado];
            if (!r) continue;
            const d = Phaser.Math.Distance.Between(img.x, img.y, r.centerx, r.centery);
            if (d < dist) { dist = d; mejor = lado; }
        }
        return mejor;
    }

    puedeElegir() { return this.esperandoHumano && this.vivo; }

    /** Coloca tus fichas: las que puedes jugar suben un poco, la elegida sube más. */
    refrescarMano(sinAnimar = null) {
        const p = this.partida;
        const turno = this.puedeElegir();
        const jugables = new Set(turno ? p.jugadasValidas(0).map(([f]) => f) : []);
        const n = this.mano.length;
        this.mano.forEach((img, k) => {
            if (img === this.arrastre || img === sinAnimar) return;
            const d = this.sitioMano(k, n);
            let y = d.y;
            if (turno && jugables.has(img.ficha)) y -= 14;
            if (img === this.seleccionada) y -= 34;
            else if (turno && img.encima) y -= 10;
            if (turno && k === this.cursor && this.teclado) y -= 6;
            img.setDepth(50 + k * 0.01);
            if (img.twMano && img.twMano.isPlaying()) img.twMano.stop();
            img.twMano = this.tweens.add({ targets: img, x: d.x, y, duration: 160, ease: 'Quad.easeOut' });
            if (img.texture.key !== 'reverso') {
                if (turno && !jugables.has(img.ficha)) img.setTint(0xa8a296); else img.clearTint();
            }
        });
        if (this.teclado && turno && this.mano[this.cursor]) {
            this.brilloCursor = this.brilloCursor || this.add.image(0, 0, 'brillo').setTint(0x9fe8ff).setDepth(49);
            const c = this.mano[this.cursor];
            this.brilloCursor.setVisible(true).setScale(ESC_MANO).setPosition(c.x, c.y);
            this.tweens.killTweensOf(this.brilloCursor);
            this.tweens.add({ targets: this.brilloCursor, x: this.sitioMano(this.cursor, n).x, y: Y_MANO - (jugables.has(c.ficha) ? 14 : 0) - (c === this.seleccionada ? 34 : 0) - 6, duration: 160 });
        } else if (this.brilloCursor) this.brilloCursor.setVisible(false);
    }

    tocarFicha(img) {
        if (!this.puedeElegir()) return;
        const p = this.partida;
        const lados = this.ladosDe(img.ficha);
        if (!lados.length) {
            Sonido.sfx('error');
            this.tweens.add({ targets: img, x: img.x + 6, duration: 50, yoyo: true, repeat: 2 });
            this.mensaje(p.fichaObligada ? TXT.tienesQueSalir(nombreFicha(p.fichaObligada)) : TXT.noEntra, ROJO);
            return;
        }
        if (lados.length === 1) { this.resolverHumano([img.ficha, lados[0]]); return; }
        if (this.seleccionada === img) { this.cancelarSeleccion(); return; }
        this.seleccionada = img;
        Sonido.sfx('levantar');
        this.mostrarHuecos(lados, this.teclado ? this.ladoTeclado : null);
        this.mensaje(TXT.dosLados);
        this.refrescarMano();
    }

    cancelarSeleccion() {
        if (!this.seleccionada) return;
        this.seleccionada = null;
        this.mostrarHuecos([]);
        this.mensaje(TXT.tuTurno);
        this.refrescarMano();
    }

    esperarHumano() {
        this.esperandoHumano = true;
        this.cursor = Math.min(this.cursor, this.mano.length - 1);
        this.refrescarMano();
        return new Promise((r) => { this.resolver = r; });
    }

    resolverHumano(jugada) {
        if (!this.esperandoHumano) return;
        this.esperandoHumano = false;
        this.seleccionada = null;
        this.arrastre = null;
        this.mostrarHuecos([]);
        if (this.pistaImg) { this.pistaImg.destroy(); this.pistaImg = null; }
        const r = this.resolver;
        this.resolver = null;
        r(jugada);
    }

    teclaLado(d) {
        if (!this.puedeElegir() || !this.mano.length) return;
        this.teclado = true;
        if (this.seleccionada) {
            this.ladoTeclado = d < 0 ? IZQ : DER;
            this.mostrarHuecos(this.ladosDe(this.seleccionada.ficha), this.ladoTeclado);
            Sonido.sfx('menu');
            return;
        }
        this.cursor = (this.cursor + d + this.mano.length) % this.mano.length;
        Sonido.sfx('menu');
        this.refrescarMano();
    }

    teclaJugar() {
        if (!this.puedeElegir()) return;
        if (!this.teclado) { this.teclado = true; this.refrescarMano(); return; }
        if (this.seleccionada) {
            if (this.ladoTeclado) this.resolverHumano([this.seleccionada.ficha, this.ladoTeclado]);
            return;
        }
        const img = this.mano[this.cursor];
        if (!img) return;
        this.ladoTeclado = null;
        this.tocarFicha(img);
    }

    darPista() {
        if (!this.puedeElegir()) return;
        const j = IA.pista(this.partida);
        if (!j) return;
        Sonido.sfx('pista');
        const img = this.mano.find((m) => m.ficha === j[0]);
        if (this.pistaImg) this.pistaImg.destroy();
        this.pistaImg = this.add.image(img.x, img.y, 'brillo').setTint(0x7dff9a).setScale(ESC_MANO).setDepth(49);
        this.tweens.add({ targets: this.pistaImg, alpha: { from: 1, to: 0.3 }, duration: 380, yoyo: true, repeat: 5, onComplete: () => { if (this.pistaImg) { this.pistaImg.destroy(); this.pistaImg = null; } } });
        this.tweens.add({ targets: img, y: img.y - 14, duration: 180, yoyo: true, repeat: 2 });
        if (this.ladosDe(j[0]).length > 1) this.mostrarHuecos([j[1]], j[1]);
        this.time.delayedCall(1600, () => { if (this.puedeElegir() && !this.seleccionada && !this.arrastre) this.mostrarHuecos([]); });
    }

    /* ------------------------------------------------------------------ fin de ronda */

    async finRonda() {
        const p = this.partida;
        const r = p.resultado;
        this.esperandoHumano = false;
        this.marcarTurno(-1);
        this.mensaje('');
        this.mensajeFondo.setVisible(false);
        this.actualizarExtremos();
        await esperar(this, 350);
        if (!this.vivo) return;
        const domino = r.motivo === DOMINO;
        Sonido.sfx(domino ? 'domino' : 'tranque');
        grito(this, domino ? TXT.gritoDomino : TXT.gritoTranque, { color: domino ? ORO : ROJO });
        if (r.ganador !== null) this.decir(r.ganador, domino ? TXT.gritoDomino : TXT.gritoTranque, 1, 1600);
        this.asientos.forEach((a, k) => {
            if (r.equipo === null) return;
            a.av.setFrame(p.jugadores[k].equipo === r.equipo ? 1 : 2);
        });
        if (r.capicua) {
            await esperar(this, 1100);
            if (!this.vivo) return;
            Sonido.sfx('capicua');
            grito(this, TXT.gritoCapicua, { color: '#7dffd8', tam: 92 });
            this.emChispas.explode(40, ANCHO / 2, ALTO / 2 - 40);
        }
        // Se enseñan las fichas que quedaron
        this.reversos.forEach((lista, i) => {
            const mano = r.manos[i];
            lista.forEach((img, k) => { if (mano[k]) this.voltear(img, `ficha_${mano[k].a}${mano[k].b}`, k * 60); });
        });
        await esperar(this, 1500);
        if (!this.vivo) return;
        this.mostrarResumen();
    }

    textosResultado() {
        const p = this.partida;
        const r = p.resultado;
        if (r.ganador === null) return [TXT.empate, ''];
        const g = p.jugadores[r.ganador];
        const detalle = r.motivo === DOMINO ? (g.humano ? TXT.teQuedaste : TXT.seQuedo(g.nombre)) : TXT.tranqueGana(g.nombre, g.humano);
        const total = r.puntos + r.bono;
        let suma;
        if (p.enParejas) suma = r.equipo === 0 ? TXT.sumamos(total) : TXT.suman(total);
        else suma = r.equipo === 0 ? TXT.sumas(total) : TXT.suma(g.nombre, total);
        return [detalle, suma];
    }

    capa(alto) {
        const objs = [];
        const velo = this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.55).setOrigin(0).setDepth(95).setInteractive();
        const panel = this.add.nineslice(ANCHO / 2, ALTO / 2, 'panel', 0, 780, alto, 18, 18, 18, 18).setDepth(96);
        objs.push(velo, panel);
        velo.setAlpha(0); this.tweens.add({ targets: velo, alpha: 1, duration: 250 });
        panel.setScale(0.85).setAlpha(0); this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
        return { objs, top: ALTO / 2 - alto / 2 };
    }

    cerrarCapa() {
        if (this.nav) { this.nav.destruir(); this.nav = null; }
        (this.capaObjs || []).forEach((o) => o.destroy());
        this.capaObjs = [];
    }

    mostrarResumen() {
        const p = this.partida;
        const r = p.resultado;
        const n = p.numJugadores;
        const alto = 250 + n * 62 + (r.capicua ? 34 : 0);
        const { objs, top } = this.capa(alto);
        const add = (o) => { objs.push(o.setDepth(97)); return o; };
        add(this.add.text(ANCHO / 2, top + 44, r.motivo === DOMINO ? TXT.gritoDomino : TXT.gritoTranque, estiloTexto(46, ORO, { fontStyle: '700' })).setOrigin(0.5));
        const [detalle, suma] = this.textosResultado();
        add(this.add.text(ANCHO / 2, top + 94, detalle, estiloTexto(22, CREMA)).setOrigin(0.5));
        let y = top + 140;
        p.jugadores.forEach((j, i) => {
            add(this.add.image(ANCHO / 2 - 330, y, 'av_' + j.avatar, r.equipo === null ? 0 : j.equipo === r.equipo ? 1 : 2).setScale(0.42));
            add(this.add.text(ANCHO / 2 - 296, y, j.nombre, estiloTexto(20, i === r.ganador ? ORO : CREMA)).setOrigin(0, 0.5));
            r.manos[i].forEach((f, k) => {
                const img = add(this.add.image(ANCHO / 2 - 120 + k * 32, y, `ficha_${f.a}${f.b}`).setScale(0.26));
                img.setAlpha(0);
                this.tweens.add({ targets: img, alpha: 1, duration: 200, delay: 150 + i * 120 + k * 50 });
            });
            if (!r.manos[i].length) add(this.add.text(ANCHO / 2 - 120, y, '—', estiloTexto(20, CREMA)).setOrigin(0, 0.5));
            add(this.add.text(ANCHO / 2 + 330, y, `${sumaMano(r.manos[i])}`, estiloTexto(22, CREMA)).setOrigin(1, 0.5));
            y += 62;
        });
        if (r.capicua) {
            add(this.add.text(ANCHO / 2, y - 8, TXT.bonoCapicua, estiloTexto(22, '#7dffd8')).setOrigin(0.5));
            y += 34;
        }
        if (suma) add(this.add.text(ANCHO / 2, y + 4, suma, estiloTexto(26, ORO)).setOrigin(0.5));
        const final = p.ganadorPartida !== null;
        const boton = crearBoton(this, ANCHO / 2, top + alto - 46, 300, 58, final ? TXT.verResultado : TXT.siguienteRonda, () => {
            this.cerrarCapa();
            if (final) this.mostrarFinal();
            else { p.nuevaRonda(); this.empezarRonda(); }
        }, { prof: 98 });
        objs.push(boton);
        this.capaObjs = objs;
        this.nav = navegacion(this, [boton]);
        // Los puntos suben en el marcador
        if (r.equipo !== null) {
            this.time.delayedCall(500, () => {
                this.actualizarMarcador(true);
                Sonido.sfx(r.equipo === 0 ? 'ganarRonda' : 'perderRonda');
            });
        }
        if (this.auto) this.time.delayedCall(1500, () => boton.active && boton.pulsar());
    }

    mostrarFinal() {
        const p = this.partida;
        const ganamos = p.ganadorPartida === 0;
        const rival = p.puntos[1 - p.ganadorPartida];
        const zapatero = rival === 0;
        const torneo = this.cfg.torneo;
        const d = Progreso.datos;
        // Estadísticas y progreso
        d.stats.partidas++;
        if (ganamos) d.stats.ganadas++;
        d.stats.capicuas += p.capicuas[0];
        if (ganamos && zapatero) d.stats.zapateros++;
        let estrellas = null, campeon = false;
        if (torneo !== undefined && torneo !== null) {
            estrellas = [ganamos, ganamos && p.puntos[1] < p.meta / 2, ganamos && p.capicuas[0] > 0];
            estrellas.forEach((e, k) => { if (e) d.estrellas[torneo][k] = true; });
            if (ganamos) {
                d.desbloqueada = Math.max(d.desbloqueada, Math.min(MESAS_TORNEO.length, torneo + 2));
                if (torneo === MESAS_TORNEO.length - 1 && !d.campeon) { d.campeon = true; campeon = true; }
            }
        }
        Progreso.guardar();

        const alto = (ganamos ? 152 : 40) + 150 + (estrellas ? 140 : 0) + 96;
        const { objs, top } = this.capa(alto);
        const add = (o) => { objs.push(o.setDepth(97)); return o; };
        let titulo;
        if (p.enParejas) titulo = ganamos ? TXT.ganamos : TXT.perdimos;
        else titulo = ganamos ? TXT.ganaste : TXT.gana(p.jugadores[1].nombre);
        let y = top + 40;
        if (ganamos) {
            const trofeo = add(this.add.image(ANCHO / 2, y + 62, 'trofeo').setScale(0.1));
            this.tweens.add({ targets: trofeo, scale: 0.62, duration: 600, ease: 'Back.easeOut' });
            y += 132;
            Sonido.musica('victoria');
            Sonido.sfx('victoria');
            lluviaConfeti(this, campeon ? 220 : 120, 99);
        } else {
            Sonido.parar();
            Sonido.sfx('derrota');
            y += 20;
        }
        add(this.add.text(ANCHO / 2, y + 10, campeon ? TXT.campeon : titulo, estiloTexto(42, ganamos ? ORO : CREMA, { fontStyle: '700' })).setOrigin(0.5));
        y += 58;
        const marcador = `${this.filasMarcador[0].nombre.text} ${p.puntos[0]}  ·  ${this.filasMarcador[1].nombre.text} ${p.puntos[1]}`;
        add(this.add.text(ANCHO / 2, y, campeon ? TXT.campeonTexto + '  ' + marcador : marcador, estiloTexto(22, CREMA)).setOrigin(0.5));
        y += 34;
        add(this.add.text(ANCHO / 2, y, `${TXT.rondas}: ${p.ronda}   ·   ${TXT.capicuas}: ${p.capicuas[0]}`, estiloTexto(18, '#d8cfbf')).setOrigin(0.5));
        if (ganamos && zapatero) {
            const z = add(this.add.text(ANCHO / 2 + 250, top + 110, TXT.gritoZapatero, estiloTexto(34, '#ff6b81', { fontStyle: '700' })).setOrigin(0.5).setAngle(-12).setScale(3).setAlpha(0));
            this.tweens.add({ targets: z, scale: 1, alpha: 1, duration: 300, delay: 700, ease: 'Back.easeOut', onStart: () => Sonido.sfx('doble') });
        }
        if (estrellas) {
            y += 48;
            estrellas.forEach((e, k) => {
                const ex = ANCHO / 2 - 220 + k * 220;
                add(this.add.image(ex, y, 'estrella_vacia').setScale(0.8));
                add(this.add.text(ex, y + 46, TXT.estrellas[k], estiloTexto(15, e ? CREMA : '#a8a090', { align: 'center', wordWrap: { width: 200 } })).setOrigin(0.5, 0));
                if (e) {
                    const s = add(this.add.image(ex, y, 'estrella').setScale(0));
                    this.tweens.add({ targets: s, scale: 0.8, angle: 360, duration: 450, delay: 600 + k * 350, ease: 'Back.easeOut', onStart: () => Sonido.sfx('estrella') });
                }
            });
        }
        const botones = [];
        const by = top + alto - 50;
        const hayOtraMesa = estrellas && ganamos && torneo < MESAS_TORNEO.length - 1;
        const opciones = [];
        if (hayOtraMesa) opciones.push([TXT.siguienteMesa, () => this.scene.start('Mesa', configTorneo(torneo + 1))]);
        opciones.push([TXT.repetir, () => this.scene.start('Mesa', this.cfg)]);
        opciones.push([TXT.menu, () => this.scene.start('Menu', { pantalla: estrellas ? 'torneo' : 'principal' })]);
        const ancho = opciones.length === 3 ? 230 : 260;
        opciones.forEach(([texto, accion], k) => {
            const b = crearBoton(this, ANCHO / 2 + (k - (opciones.length - 1) / 2) * (ancho + 20), by, ancho, 58, texto, accion, { prof: 98, tam: 24 });
            botones.push(b); objs.push(b);
        });
        this.capaObjs = objs;
        this.nav = navegacion(this, botones);
    }

    pausar() {
        if (this.capaObjs && this.capaObjs.length) return;
        this.scene.launch('Pausa');
        this.scene.pause();
    }
}

function configTorneo(i) {
    const m = MESAS_TORNEO[i];
    return { torneo: i, tema: m.tema, meta: m.meta, rivales: m.rivales };
}

function configRapida(o) {
    const n = o.nivel;
    const rivales = o.modo === 4 ? [['pedro', n], ['lucia', n], ['andres', n]] : [['pedro', n]];
    return { torneo: null, tema: o.tema, meta: o.meta, rivales };
}
