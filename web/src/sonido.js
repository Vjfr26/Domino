/* Sonido del dominó, todo sintetizado con WebAudio: el clac de las fichas, el barajado, los
   golpes en la mesa al pasar, fanfarrias y una música suave con aire de son para cada mesa.
   El navegador solo deja sonar audio tras un gesto del jugador (Sonido.iniciar). */
const Sonido = (() => {
    const CLAVE = 'domino-sonido';
    let activo = true, musicaActiva = true;
    try {
        activo = localStorage.getItem(CLAVE) !== 'no';
        musicaActiva = localStorage.getItem(CLAVE + '-musica') !== 'no';
    } catch (e) { /* sin almacenamiento */ }

    let ctx = null, maestro = null, busSfx = null, busMusica = null, ruidoBuffer = null;
    let pendiente = null;

    function iniciar() {
        if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        maestro = ctx.createGain();
        maestro.gain.value = activo ? 1 : 0;
        maestro.connect(comp);
        busSfx = ctx.createGain(); busSfx.gain.value = 0.6; busSfx.connect(maestro);
        busMusica = ctx.createGain(); busMusica.gain.value = musicaActiva ? 0.2 : 0; busMusica.connect(maestro);
        ruidoBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = ruidoBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        if (pendiente) { const p = pendiente; pendiente = null; musica(p); }
    }

    function tono({ tipo = 'sine', f0 = 440, f1 = f0, dur = 0.12, vol = 0.25, retardo = 0, ataque = 0.005, bus = busSfx }) {
        if (!ctx) return;
        const t = ctx.currentTime + retardo;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = tipo;
        osc.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + ataque);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dur + 0.02);
    }

    function ruido({ dur = 0.1, vol = 0.3, f0 = 2000, f1 = f0, tipo = 'bandpass', q = 1, retardo = 0, bus = busSfx }) {
        if (!ctx) return;
        const t = ctx.currentTime + retardo;
        const src = ctx.createBufferSource();
        src.buffer = ruidoBuffer;
        const filtro = ctx.createBiquadFilter();
        filtro.type = tipo; filtro.Q.value = q;
        filtro.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) filtro.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filtro); filtro.connect(g); g.connect(bus);
        src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.02);
    }

    const nota = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const azar = (a, b) => a + Math.random() * (b - a);

    /** El "clac" de una ficha contra la mesa: dos golpes cortos y un golpe sordo. */
    function clac(fuerza = 1, retardo = 0) {
        const tono0 = azar(0.9, 1.15);
        ruido({ dur: 0.035, vol: 0.5 * fuerza, f0: 3200 * tono0, q: 2.5, retardo });
        ruido({ dur: 0.05, vol: 0.28 * fuerza, f0: 1500 * tono0, q: 3, retardo: retardo + 0.012 });
        tono({ tipo: 'sine', f0: 190 * tono0, f1: 70, dur: 0.09, vol: 0.32 * fuerza, retardo });
    }

    const EFECTOS = {
        ficha: () => clac(1),
        doble: () => { clac(1.4); tono({ tipo: 'sine', f0: 120, f1: 45, dur: 0.22, vol: 0.4 }); },
        barajar: () => { for (let i = 0; i < 16; i++) clac(azar(0.25, 0.5), i * 0.055 + azar(0, 0.03)); },
        repartir: (i = 0) => ruido({ dur: 0.06, vol: 0.12, f0: 5000, f1: 2500, tipo: 'highpass', retardo: i * 0.001 }),
        girar: () => ruido({ dur: 0.05, vol: 0.1, f0: 6000, tipo: 'highpass' }),
        robar: () => { ruido({ dur: 0.12, vol: 0.14, f0: 4000, f1: 1500, tipo: 'highpass' }); clac(0.5, 0.1); },
        // Dos golpecitos con los nudillos en la mesa
        paso: () => [0, 0.16].forEach((r) => { tono({ tipo: 'sine', f0: 140, f1: 70, dur: 0.12, vol: 0.45, retardo: r }); ruido({ dur: 0.04, vol: 0.2, f0: 900, q: 1, retardo: r }); }),
        elegir: () => { tono({ tipo: 'triangle', f0: nota(79), dur: 0.06, vol: 0.1 }); tono({ tipo: 'triangle', f0: nota(86), dur: 0.12, vol: 0.1, retardo: 0.06 }); },
        menu: () => tono({ tipo: 'triangle', f0: nota(84), dur: 0.05, vol: 0.08 }),
        levantar: () => tono({ tipo: 'sine', f0: nota(88), f1: nota(91), dur: 0.06, vol: 0.06 }),
        error: () => { tono({ tipo: 'square', f0: 220, f1: 180, dur: 0.12, vol: 0.06 }); tono({ tipo: 'square', f0: 185, f1: 150, dur: 0.16, vol: 0.06, retardo: 0.1 }); },
        turno: () => [76, 81].forEach((n, i) => tono({ tipo: 'sine', f0: nota(n), dur: 0.18, vol: 0.09, retardo: i * 0.09 })),
        pista: () => [84, 88, 91].forEach((n, i) => tono({ tipo: 'sine', f0: nota(n), dur: 0.2, vol: 0.07, retardo: i * 0.05 })),
        domino: () => { clac(1.6); [72, 76, 79, 84].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.3, vol: 0.16, retardo: 0.15 + i * 0.09 })); },
        tranque: () => { tono({ tipo: 'sine', f0: 110, f1: 55, dur: 0.5, vol: 0.4 }); [57, 60, 64].forEach((n) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.7, vol: 0.08, retardo: 0.1 })); },
        capicua: () => [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.25, vol: 0.12, retardo: i * 0.06 })),
        puntos: () => tono({ tipo: 'square', f0: nota(91), dur: 0.03, vol: 0.03 }),
        ganarRonda: () => [67, 72, 76, 79].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.25, vol: 0.14, retardo: i * 0.1 })),
        perderRonda: () => [64, 62, 59].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: 0.3, vol: 0.12, retardo: i * 0.14 })),
        victoria: () => [72, 76, 79, 84, 79, 84, 88, 91].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: i === 7 ? 0.8 : 0.16, vol: 0.15, retardo: i * 0.13 })),
        derrota: () => [67, 65, 64, 60].forEach((n, i) => tono({ tipo: 'triangle', f0: nota(n), dur: i === 3 ? 0.8 : 0.3, vol: 0.13, retardo: i * 0.22 })),
        estrella: () => [84, 91].forEach((n, i) => tono({ tipo: 'sine', f0: nota(n), dur: 0.25, vol: 0.12, retardo: i * 0.07 })),
    };

    function sfx(nombre, arg) {
        if (!ctx || !activo) return;
        const f = EFECTOS[nombre];
        if (f) f(arg);
    }

    /* ---------- Música: bajo anticipado, un tres que arpegia, clave 3-2 y maracas ---------- */
    const ACORDES = { M: [0, 4, 7, 12, 16], m: [0, 3, 7, 12, 15], 7: [0, 4, 7, 10, 12] };
    const CANCIONES = {
        menu: { bpm: 96, acordes: [[48, 'M'], [53, 'M'], [55, '7'], [53, 'M']],
            melodia: [76, null, null, 79, null, 77, 76, null, 74, null, 72, null, null, null, null, null,
                      77, null, null, 81, null, 79, 77, null, 76, null, 74, null, null, null, null, null] },
        plaza: { bpm: 104, acordes: [[48, 'M'], [53, 'M'], [55, '7'], [48, 'M']],
            melodia: [72, null, 76, null, 79, null, 76, null, 77, null, 74, null, 71, null, null, null,
                      72, null, 76, null, 79, null, 81, 79, 77, null, 76, null, 72, null, null, null] },
        club: { bpm: 88, acordes: [[45, 'm'], [50, 'm'], [52, '7'], [45, 'm']],
            melodia: [76, null, null, 74, 72, null, 71, null, 72, null, null, null, 69, null, null, null,
                      77, null, null, 76, 74, null, 72, null, 71, null, 68, null, 69, null, null, null] },
        final: { bpm: 116, acordes: [[50, 'm'], [55, 'm'], [57, '7'], [50, 'm']],
            melodia: [74, null, 77, 81, null, 79, 77, null, 76, null, 77, null, 74, null, null, null,
                      77, null, 81, 84, null, 82, 81, null, 79, null, 76, null, 74, null, null, null] },
        victoria: { bpm: 112, acordes: [[48, 'M'], [55, '7'], [53, 'M'], [55, '7']],
            melodia: [79, null, 84, null, 88, null, 84, null, 86, null, 83, null, 79, null, null, null,
                      81, null, 84, null, 88, null, 91, null, 88, null, 86, null, 84, null, null, null] },
    };
    const CLAVE_32 = [0, 6, 12, 20, 24]; // clave de son 3-2 en dos compases de 16
    const TRES = [0, 3, 6, 8, 10, 13, 14];

    let actual = null, temporizador = null, paso = 0, proxima = 0;

    function programar() {
        const c = CANCIONES[actual];
        if (!c || !ctx) return;
        const dur = 60 / c.bpm / 4;
        while (proxima < ctx.currentTime + 0.15) {
            const compas = Math.floor(paso / 16) % c.acordes.length;
            const p = paso % 16;
            const [raiz, tipo] = c.acordes[compas];
            const t0 = proxima - ctx.currentTime;
            const notas = ACORDES[tipo];
            // Bajo de son: en el "y" del 2 y en el 4 (anticipado)
            if (p === 6 || p === 12) tono({ tipo: 'triangle', f0: nota(raiz - 12 + (p === 12 ? 7 : 0)), dur: dur * 5, vol: 0.34, retardo: t0, ataque: 0.01, bus: busMusica });
            if (p === 0 && paso === 0) tono({ tipo: 'triangle', f0: nota(raiz - 12), dur: dur * 5, vol: 0.34, retardo: t0, bus: busMusica });
            // Tres (guitarra) que arpegia el acorde
            const k = TRES.indexOf(p);
            if (k >= 0) {
                const n = raiz + 12 + notas[(k + compas) % notas.length];
                tono({ tipo: 'triangle', f0: nota(n), dur: dur * 2.2, vol: 0.07, retardo: t0, ataque: 0.002, bus: busMusica });
                tono({ tipo: 'sine', f0: nota(n + 12), dur: dur * 1.2, vol: 0.025, retardo: t0, ataque: 0.002, bus: busMusica });
            }
            // Clave y maracas
            if (CLAVE_32.includes(paso % 32)) tono({ tipo: 'sine', f0: 2100, dur: 0.05, vol: 0.06, retardo: t0, ataque: 0.001, bus: busMusica });
            if (p % 2 === 0) ruido({ dur: 0.05, vol: p % 4 === 2 ? 0.05 : 0.025, f0: 7000, tipo: 'highpass', retardo: t0, bus: busMusica });
            const m = c.melodia[paso % c.melodia.length];
            if (m) tono({ tipo: 'sine', f0: nota(m), dur: dur * 2.6, vol: 0.06, retardo: t0, ataque: 0.02, bus: busMusica });
            proxima += dur;
            paso++;
        }
    }

    function musica(nombre) {
        if (!ctx) { pendiente = nombre; return; }
        if (actual === nombre) return;
        parar();
        actual = nombre;
        paso = 0;
        proxima = ctx.currentTime + 0.05;
        temporizador = setInterval(programar, 40);
    }

    function parar() {
        if (temporizador) clearInterval(temporizador);
        temporizador = null;
        actual = null;
    }

    function guardar() {
        try {
            localStorage.setItem(CLAVE, activo ? 'si' : 'no');
            localStorage.setItem(CLAVE + '-musica', musicaActiva ? 'si' : 'no');
        } catch (e) { /* sin almacenamiento */ }
    }

    function alternar() {
        activo = !activo;
        guardar();
        if (maestro) maestro.gain.setTargetAtTime(activo ? 1 : 0, ctx.currentTime, 0.02);
        return activo;
    }

    function alternarMusica() {
        musicaActiva = !musicaActiva;
        guardar();
        if (busMusica) busMusica.gain.setTargetAtTime(musicaActiva ? 0.2 : 0, ctx.currentTime, 0.05);
        return musicaActiva;
    }

    document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    return {
        iniciar, sfx, musica, parar, alternar, alternarMusica,
        get activo() { return activo; },
        get musicaActiva() { return musicaActiva; },
    };
})();
