/* Dónde va cada ficha de la mesa. Las fichas salen del centro hacia los dos lados; cuando un
   brazo llega al borde, la ficha de la esquina se pone vertical y la fila sigue en sentido
   contrario, como una serpiente (el brazo derecho baja y el izquierdo sube). Los dobles van
   atravesados, como en una mesa de verdad. Prueba tamaños de mayor a menor hasta que todo cabe. */

class Rect {
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
    get left() { return this.x; }
    get right() { return this.x + this.w; }
    get top() { return this.y; }
    get bottom() { return this.y + this.h; }
    get centerx() { return this.x + this.w / 2; }
    get centery() { return this.y + this.h / 2; }
    get center() { return [this.centerx, this.centery]; }
    contains(r) { return r.x >= this.x && r.y >= this.y && r.right <= this.right && r.bottom <= this.bottom; }
    collidepoint(x, y) { return x >= this.x && x < this.right && y >= this.y && y < this.bottom; }
    inflate(dx, dy) { return new Rect(this.x - dx / 2, this.y - dy / 2, this.w + dx, this.h + dy); }
}

const TAMANOS_MESA = [34, 30, 27, 24, 21, 18, 16];
// Ficha cualquiera (no doble) para calcular dónde iría la siguiente jugada
const HUECO_FALSO = { ficha: { a: 0, b: 1 }, interior: 0, exterior: 1 };

/**
 * Devuelve { fichas: [{ ficha, rect, numeros, vertical }], huecos: { izq, der } | { centro }, tam }.
 * `numeros` es [izquierda, derecha] si la ficha va acostada, o [arriba, abajo] si va de pie.
 */
function disponer(mesa, area) {
    let disp;
    for (const tam of TAMANOS_MESA) {
        disp = disponerConTam(mesa, area, tam);
        const rects = [...disp.fichas.map((f) => f.rect), ...Object.values(disp.huecos)];
        if (rects.every((r) => area.contains(r))) break;
    }
    return disp;
}

function disponerConTam(mesa, area, tam) {
    const [cx, cy] = area.center;
    const largo = 2 * tam;
    const medio = tam / 2;
    if (mesa.vacia) return { fichas: [], huecos: { [CENTRO]: new Rect(cx - tam, cy - medio, largo, tam) }, tam };

    const c = mesa.centro;
    const rect = esDoble(c) ? new Rect(cx - medio, cy - tam, tam, largo) : new Rect(cx - tam, cy - medio, largo, tam);
    const fichas = [{ ficha: c, rect, numeros: [c.a, c.b], vertical: esDoble(c) }];
    const huecos = {};
    for (const [lado, x, sentido] of [[DER, rect.right, 1], [IZQ, rect.left, -1]]) {
        const brazo = disponerBrazo([...mesa.brazos[lado], HUECO_FALSO], x, cy, sentido, area, tam);
        fichas.push(...brazo.slice(0, -1));
        huecos[lado] = brazo[brazo.length - 1].rect;
    }
    return { fichas, huecos, tam };
}

function disponerBrazo(colocadas, x, y, sentido, area, tam) {
    const giro = sentido; // 1: las filas nuevas van abajo; -1: van arriba
    const largo = 2 * tam;
    const medio = tam / 2;
    const resultado = [];
    let trasEsquina = false;
    for (const c of colocadas) {
        // Justo después de una esquina el doble va acostado para no chocar con ella
        const atravesada = esDoble(c.ficha) && !trasEsquina;
        const ancho = atravesada ? tam : largo;
        const cabe = sentido === 1 ? x + ancho <= area.right - tam : x - ancho >= area.left + tam;
        if (!cabe) {
            // Ficha de la esquina: de pie, y la fila siguiente va al revés
            const columna = sentido === 1 ? x : x - tam;
            let rect, numeros;
            if (giro === 1) { rect = new Rect(columna, y - medio, tam, largo); numeros = [c.interior, c.exterior]; }
            else { rect = new Rect(columna, y - largo + medio, tam, largo); numeros = [c.exterior, c.interior]; }
            resultado.push({ ficha: c.ficha, rect, numeros, vertical: true });
            y += giro * largo;
            sentido = -sentido;
            x = sentido === -1 ? columna + tam : columna;
            trasEsquina = true;
            continue;
        }
        let izquierda;
        if (sentido === 1) { izquierda = x; x += ancho; } else { x -= ancho; izquierda = x; }
        if (atravesada) {
            resultado.push({ ficha: c.ficha, rect: new Rect(izquierda, y - tam, tam, largo), numeros: [c.interior, c.exterior], vertical: true });
        } else {
            const numeros = sentido === 1 ? [c.interior, c.exterior] : [c.exterior, c.interior];
            resultado.push({ ficha: c.ficha, rect: new Rect(izquierda, y - medio, largo, tam), numeros, vertical: false });
        }
        trasEsquina = false;
    }
    return resultado;
}

/** Ángulo con el que se dibuja la textura de una ficha (de pie: a arriba, b abajo) para que
    enseñe `numeros` en su sitio. Las texturas son simétricas al girarlas media vuelta. */
function anguloFicha(f, numeros, vertical) {
    if (esDoble(f)) return vertical ? 0 : -90;
    if (vertical) return numeros[0] === f.a ? 0 : 180;
    return numeros[0] === f.a ? -90 : 90;
}
