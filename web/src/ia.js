/* Los jugadores que maneja la computadora, en tres niveles:
   - Fácil: juega casi al azar, con algo de sentido común.
   - Normal: las ideas de un buen jugador de café (soltar las gordas y los dobles, quedarse
     con números que lleva, castigar los números con los que el rival ya pasó…).
   - Experto: además de lo anterior, simula la ronda cientos de veces repartiendo al azar las
     fichas que no ve (respetando con qué números pasó cada uno) y elige la jugada que mejor
     resultado medio da a su equipo. */

const NIVELES = { FACIL: 0, NORMAL: 1, EXPERTO: 2 };

const IA = (() => {
    const OTRO_LADO = { [IZQ]: DER, [DER]: IZQ };
    const subconjunto = (a, b) => [...a].every((x) => b.has(x));

    /** Los extremos que quedarían en la mesa tras la jugada. */
    function extremosTras(partida, [f, lado]) {
        if (lado === CENTRO) return new Set([f.a, f.b]);
        const nuevo = otroNumero(f, partida.mesa.extremo(lado));
        return new Set([nuevo, partida.mesa.extremo(OTRO_LADO[lado])]);
    }

    function puntajeNormal(partida, jugada) {
        const [f] = jugada;
        const indice = partida.turno;
        const mano = partida.jugadores[indice].mano;
        const rival = (indice + 1) % partida.numJugadores;
        const companero = partida.enParejas ? (indice + 2) % partida.numJugadores : null;
        const extremos = extremosTras(partida, jugada);
        const resto = mano.filter((g) => g !== f);
        let valor = puntosFicha(f) + (esDoble(f) ? 4 : 0);
        valor += 2 * resto.filter((g) => [...extremos].some((x) => tiene(g, x))).length;
        if (subconjunto(extremos, partida.sinNumeros[rival])) valor += 6;
        if (companero !== null && subconjunto(extremos, partida.sinNumeros[companero])) valor -= 3;
        // Cerrar la ronda siempre es lo mejor
        if (resto.length === 0) valor += 100;
        return valor;
    }

    function mejorPor(jugadas, puntaje) {
        let mejor = jugadas[0], mejorP = -Infinity;
        for (const j of jugadas) {
            const p = puntaje(j) + Math.random() * 0.5; // desempate al azar
            if (p > mejorP) { mejor = j; mejorP = p; }
        }
        return mejor;
    }

    /* ---------------- Simulación rápida para el nivel experto ---------------- */

    /** Reparte al azar las fichas que no se ven, respetando los números con los que pasó cada uno. */
    function muestrear(partida, yo) {
        const vistas = new Set([...partida.jugadores[yo].mano, ...partida.mesa.todas()]);
        const ocultas = TODAS.filter((f) => !vistas.has(f));
        const manos = partida.jugadores.map((j) => (j === partida.jugadores[yo] ? [...j.mano] : null));
        for (let intento = 0; intento < 30; intento++) {
            barajar(ocultas);
            const libres = [...ocultas];
            let ok = true;
            // Primero los más restringidos
            const orden = partida.jugadores.map((_, i) => i).filter((i) => i !== yo)
                .sort((x, y) => partida.sinNumeros[y].size - partida.sinNumeros[x].size);
            const reparto = {};
            for (const i of orden) {
                const prohibidos = intento < 25 ? partida.sinNumeros[i] : new Set();
                const n = partida.jugadores[i].mano.length;
                const mano = [];
                for (let k = 0; k < libres.length && mano.length < n;) {
                    const f = libres[k];
                    if (!prohibidos.has(f.a) && !prohibidos.has(f.b)) { mano.push(f); libres.splice(k, 1); } else k++;
                }
                if (mano.length < n) { ok = false; break; }
                reparto[i] = mano;
            }
            if (!ok) continue;
            for (const i of Object.keys(reparto)) manos[i] = reparto[i];
            return { manos, pozo: libres };
        }
        // No debería pasar: sin restricciones
        barajar(ocultas);
        let k = 0;
        partida.jugadores.forEach((j, i) => { if (i !== yo) { manos[i] = ocultas.slice(k, k + j.mano.length); k += j.mano.length; } });
        return { manos, pozo: ocultas.slice(k) };
    }

    /** Juega la ronda hasta el final con una estrategia sencilla. Devuelve el valor para `equipo`. */
    function simular(manos, izq, der, pozo, turno, n, equipo) {
        let pases = 0;
        let ultimaPorAmbos = false;
        for (let pasos = 0; pasos < 120; pasos++) {
            const mano = manos[turno];
            let mejor = -1, mejorP = -Infinity, lado = null;
            for (let k = 0; k < mano.length; k++) {
                const f = mano[k];
                let l = null;
                if (izq === null) l = CENTRO;
                else if (f.a === izq || f.b === izq) l = IZQ;
                else if (f.a === der || f.b === der) l = DER;
                if (!l) continue;
                const p = f.a + f.b + (f.a === f.b ? 4 : 0) + Math.random() * 3;
                if (p > mejorP) { mejorP = p; mejor = k; lado = l; }
            }
            if (mejor === -1) {
                if (pozo.length) { mano.push(pozo.pop()); continue; }
                pases++;
                if (pases >= n) return valorFinal(manos, null, equipo, false);
                turno = (turno + 1) % n;
                continue;
            }
            pases = 0;
            const f = mano[mejor];
            mano.splice(mejor, 1);
            if (lado === CENTRO) { izq = f.a; der = f.b; ultimaPorAmbos = false; }
            else {
                ultimaPorAmbos = (f.a === izq || f.b === izq) && (f.a === der || f.b === der);
                if (lado === IZQ) izq = f.a === izq ? f.b : f.a;
                else der = f.a === der ? f.b : f.a;
            }
            if (!mano.length) return valorFinal(manos, turno, equipo, ultimaPorAmbos);
            turno = (turno + 1) % n;
        }
        return 0;
    }

    function valorFinal(manos, ganador, equipo, capicua) {
        const total = manos.reduce((s, m) => s + sumaMano(m), 0);
        if (ganador === null) {
            // Tranque: gana la mano más ligera (empate entre equipos: nadie)
            const sumas = manos.map(sumaMano);
            const min = Math.min(...sumas);
            const equipos = new Set(sumas.flatMap((s, i) => (s === min ? [i % 2] : [])));
            if (equipos.size > 1) return 0;
            ganador = sumas.indexOf(min);
        }
        const v = total + (capicua ? BONO_CAPICUA : 0) + 10; // +10: ganar la mano vale por sí mismo
        return ganador % 2 === equipo ? v : -v;
    }

    function elegirExperto(partida, jugadas) {
        const yo = partida.turno;
        const equipo = yo % 2;
        const n = partida.numJugadores;
        const suma = new Array(jugadas.length).fill(0);
        const MUESTRAS = 160;
        for (let s = 0; s < MUESTRAS; s++) {
            const { manos, pozo } = muestrear(partida, yo);
            jugadas.forEach(([f, lado], k) => {
                const copia = manos.map((m) => [...m]);
                copia[yo].splice(copia[yo].indexOf(f), 1);
                let izq, der, capicua = false;
                if (lado === CENTRO) { izq = f.a; der = f.b; }
                else {
                    [izq, der] = partida.mesa.extremos();
                    capicua = tiene(f, izq) && tiene(f, der);
                    if (lado === IZQ) izq = otroNumero(f, izq); else der = otroNumero(f, der);
                }
                if (!copia[yo].length) { suma[k] += valorFinal(copia, yo, equipo, capicua); return; }
                suma[k] += simular(copia, izq, der, [...pozo], (yo + 1) % n, n, equipo);
            });
        }
        // Pequeño desempate con la heurística normal
        let mejor = 0, mejorV = -Infinity;
        jugadas.forEach((j, k) => {
            const v = suma[k] / MUESTRAS + puntajeNormal(partida, j) * 0.05;
            if (v > mejorV) { mejorV = v; mejor = k; }
        });
        return jugadas[mejor];
    }

    return {
        /** La jugada [ficha, lado] del jugador de turno, o null si no tiene ninguna. */
        elegir(partida, nivel = NIVELES.NORMAL) {
            const jugadas = partida.jugadasValidas();
            if (!jugadas.length) return null;
            if (jugadas.length === 1) return jugadas[0];
            if (nivel === NIVELES.FACIL) {
                if (Math.random() < 0.55) return jugadas[Math.floor(Math.random() * jugadas.length)];
                return mejorPor(jugadas, ([f]) => puntosFicha(f));
            }
            if (nivel === NIVELES.EXPERTO) return elegirExperto(partida, jugadas);
            return mejorPor(jugadas, (j) => puntajeNormal(partida, j));
        },
        /** La mejor jugada según el nivel experto: sirve de pista para el jugador humano. */
        pista(partida) {
            const jugadas = partida.jugadasValidas();
            if (!jugadas.length) return null;
            return elegirExperto(partida, jugadas);
        },
    };
})();
