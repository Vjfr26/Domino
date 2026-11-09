/* Reglas del dominó doble seis al estilo latino, sin nada de gráficos (se puede probar en Node).
   - 28 fichas, del doble blanco al doble seis, 7 por jugador.
   - 4 jugadores: en parejas (0 y 2 contra 1 y 3), sin pozo: si no llevas, pasas.
   - 2 jugadores: las 14 fichas que sobran son el pozo; si no llevas, robas hasta poder jugar.
   - La primera ronda la abre el doble más alto; las siguientes, quien ganó la anterior.
   - Dominó: alguien se queda sin fichas. Tranque: nadie puede jugar; gana quien tenga menos
     puntos en la mano (si empatan jugadores de equipos distintos, nadie suma).
   - El equipo ganador suma los puntos de todas las fichas que quedan en las manos.
   - Capicúa: si la última ficha entraba por los dos extremos, el equipo suma 25 más. */

const IZQ = 'izq', DER = 'der', CENTRO = 'centro';
const DOMINO = 'domino', TRANQUE = 'tranque';
const BONO_CAPICUA = 25;

const TODAS = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) TODAS.push(Object.freeze({ a, b, id: `${a}${b}` }));

const puntosFicha = (f) => f.a + f.b;
const esDoble = (f) => f.a === f.b;
const tiene = (f, n) => f.a === n || f.b === n;
const otroNumero = (f, n) => (f.a === n ? f.b : f.a);
const compararFichas = (x, y) => x.a - y.a || x.b - y.b;
const fichaDe = (a, b) => TODAS.find((f) => f.a === Math.min(a, b) && f.b === Math.max(a, b));
const sumaMano = (mano) => mano.reduce((s, f) => s + puntosFicha(f), 0);

function barajar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
}

/** Las fichas jugadas: una central y dos brazos que crecen hacia afuera. */
class MesaDomino {
    constructor() {
        this.centro = null;
        this.brazos = { [IZQ]: [], [DER]: [] };
    }

    get vacia() { return this.centro === null; }
    get length() { return this.vacia ? 0 : 1 + this.brazos[IZQ].length + this.brazos[DER].length; }

    extremo(lado) {
        const brazo = this.brazos[lado];
        if (brazo.length) return brazo[brazo.length - 1].exterior;
        return lado === IZQ ? this.centro.a : this.centro.b;
    }

    extremos() { return [this.extremo(IZQ), this.extremo(DER)]; }

    ladosValidos(f) {
        if (this.vacia) return [CENTRO];
        return [IZQ, DER].filter((lado) => tiene(f, this.extremo(lado)));
    }

    colocar(f, lado) {
        if (!this.ladosValidos(f).includes(lado)) throw new Error(`[${f.a}|${f.b}] no entra por ${lado}`);
        if (lado === CENTRO) { this.centro = f; return; }
        const n = this.extremo(lado);
        this.brazos[lado].push({ ficha: f, interior: n, exterior: otroNumero(f, n) });
    }

    todas() {
        if (this.vacia) return [];
        return [this.centro, ...this.brazos[IZQ].map((c) => c.ficha), ...this.brazos[DER].map((c) => c.ficha)];
    }
}

/**
 * Una partida: varias rondas hasta que un equipo llega a la meta.
 * `jugadores` es una lista de { nombre, avatar, humano, nivel } (2 o 4).
 */
class PartidaDomino {
    constructor(jugadores, meta = 100) {
        this.meta = meta;
        this.jugadores = jugadores.map((j, i) => Object.assign({ equipo: i % 2, mano: [], humano: false, nivel: 1 }, j));
        this.puntos = [0, 0];
        this.ronda = 0;
        this.proximoAbridor = null;
        this.capicuas = [0, 0];
        this.nuevaRonda();
    }

    get numJugadores() { return this.jugadores.length; }
    get enParejas() { return this.numJugadores === 4; }
    get rondaTerminada() { return this.resultado !== null; }
    get ganadorPartida() {
        const e = this.puntos.findIndex((p) => p >= this.meta);
        return e === -1 ? null : e;
    }

    nuevaRonda() {
        if (this.ganadorPartida !== null) throw new Error('La partida ya terminó');
        const fichas = barajar([...TODAS]);
        const n = 7;
        this.jugadores.forEach((j, i) => { j.mano = fichas.slice(i * n, (i + 1) * n).sort(compararFichas); });
        this.pozo = fichas.slice(this.numJugadores * n);
        this.mesa = new MesaDomino();
        this.resultado = null;
        this.ultima = null;
        // Números que cada jugador demostró no tener (pasó con ellos en la mesa)
        this.sinNumeros = this.jugadores.map(() => new Set());
        this.ronda++;
        if (this.proximoAbridor === null) {
            [this.turno, this.fichaObligada] = this.salidaInicial();
        } else {
            this.turno = this.proximoAbridor;
            this.fichaObligada = null;
        }
        this.abridor = this.turno;
    }

    /** Quién abre la primera ronda: el doble más alto (si nadie tiene dobles, la ficha que más vale). */
    salidaInicial() {
        const peso = (f) => (esDoble(f) ? 1000 : 0) + puntosFicha(f) * 10 + f.b;
        let mejor = null;
        this.jugadores.forEach((j, i) => {
            for (const f of j.mano) if (!mejor || peso(f) > peso(mejor[1])) mejor = [i, f];
        });
        return mejor;
    }

    jugadasValidas(indice = this.turno) {
        if (this.rondaTerminada) return [];
        const mano = this.jugadores[indice].mano;
        if (this.fichaObligada) return mano.includes(this.fichaObligada) ? [[this.fichaObligada, CENTRO]] : [];
        const r = [];
        for (const f of mano) for (const lado of this.mesa.ladosValidos(f)) r.push([f, lado]);
        return r;
    }

    esValida(f, lado) { return this.jugadasValidas().some(([g, l]) => g === f && l === lado); }
    puedeJugar(indice) { return this.jugadasValidas(indice).length > 0; }
    debeRobar() { return !this.rondaTerminada && this.pozo.length > 0 && !this.puedeJugar(); }
    debePasar() { return !this.rondaTerminada && this.pozo.length === 0 && !this.puedeJugar(); }

    jugar(f, lado) {
        if (!this.esValida(f, lado)) throw new Error(`Jugada no permitida: [${f.a}|${f.b}] por ${lado}`);
        const indice = this.turno;
        const jugador = this.jugadores[indice];
        // ¿Entraba por los dos extremos? (capicúa si además es la última)
        const porAmbos = !this.mesa.vacia && this.mesa.extremos().every((n) => tiene(f, n));
        jugador.mano.splice(jugador.mano.indexOf(f), 1);
        this.mesa.colocar(f, lado);
        this.fichaObligada = null;
        this.ultima = { jugador: indice, ficha: f, lado };
        if (!jugador.mano.length) this.terminarRonda(DOMINO, indice, porAmbos);
        else if (!this.alguienPuedeSeguir()) this.terminarRonda(TRANQUE, this.ganadorTranque(), false);
        else this.pasarTurno();
    }

    /** Roba una ficha del pozo; el turno sigue siendo del mismo jugador. */
    robar() {
        if (!this.debeRobar()) throw new Error('Ahora no se puede robar');
        const f = this.pozo.pop();
        const mano = this.jugadores[this.turno].mano;
        mano.push(f);
        mano.sort(compararFichas);
        // Si con la última del pozo nadie puede jugar, la ronda se tranca
        if (!this.alguienPuedeSeguir()) this.terminarRonda(TRANQUE, this.ganadorTranque(), false);
        return f;
    }

    pasar() {
        if (!this.debePasar()) throw new Error('No puedes pasar si tienes jugada o queda pozo');
        for (const n of this.mesa.extremos()) this.sinNumeros[this.turno].add(n);
        if (!this.alguienPuedeSeguir()) this.terminarRonda(TRANQUE, this.ganadorTranque(), false);
        else this.pasarTurno();
    }

    pasarTurno() { this.turno = (this.turno + 1) % this.numJugadores; }

    alguienPuedeSeguir() {
        return this.pozo.length > 0 || this.jugadores.some((_, i) => this.puedeJugar(i));
    }

    ganadorTranque() {
        const enMano = this.jugadores.map((j) => sumaMano(j.mano));
        const minimo = Math.min(...enMano);
        const empatados = enMano.flatMap((p, i) => (p === minimo ? [i] : []));
        if (new Set(empatados.map((i) => this.jugadores[i].equipo)).size > 1) return null;
        return empatados[0];
    }

    terminarRonda(motivo, ganador, capicua) {
        const manos = this.jugadores.map((j) => [...j.mano]);
        let equipo = null, suma = 0, bono = 0;
        if (ganador === null) {
            this.proximoAbridor = (this.abridor + 1) % this.numJugadores;
        } else {
            equipo = this.jugadores[ganador].equipo;
            suma = manos.flat().reduce((s, f) => s + puntosFicha(f), 0);
            if (capicua) { bono = BONO_CAPICUA; this.capicuas[equipo]++; }
            this.puntos[equipo] += suma + bono;
            this.proximoAbridor = ganador;
        }
        this.resultado = { motivo, ganador, equipo, puntos: suma, bono, capicua: !!capicua && ganador !== null, manos };
    }
}
