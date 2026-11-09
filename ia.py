"""Estrategia de los jugadores que maneja la computadora."""
from __future__ import annotations

import random

from motor import CENTRO, DERECHA, IZQUIERDA, Ficha, Juego

OTRO_LADO = {IZQUIERDA: DERECHA, DERECHA: IZQUIERDA}


def elegir_jugada(juego: Juego, rng: random.Random | None = None) -> tuple[Ficha, str] | None:
    """Elige la jugada del jugador de turno, o None si no tiene ninguna.

    Puntúa cada jugada posible con las ideas de un buen jugador:
    - soltar primero las fichas que más valen y los dobles (son difíciles de colocar),
    - dejar en la mesa números que todavía tiene, para poder seguir jugando,
    - dejar números que el rival siguiente no tiene (se sabe porque ya pasó con ellos),
    - en parejas, no dejar números con los que su compañero ya pasó.
    """
    rng = rng or random.Random()
    jugadas = juego.jugadas_validas()
    if not jugadas:
        return None
    indice = juego.turno
    mano = juego.jugadores[indice].mano
    rival = (indice + 1) % juego.num_jugadores
    companero = (indice + 2) % juego.num_jugadores if juego.en_parejas else None

    def puntaje(jugada: tuple[Ficha, str]) -> float:
        ficha, lado = jugada
        if lado == CENTRO:
            extremos = {ficha.a, ficha.b}
        else:
            nuevo = ficha.otro(juego.mesa.extremo(lado))
            extremos = {nuevo, juego.mesa.extremo(OTRO_LADO[lado])}
        resto = [f for f in mano if f != ficha]
        valor = ficha.puntos + (4 if ficha.es_doble else 0)
        valor += 2 * sum(1 for f in resto if any(f.tiene(x) for x in extremos))
        if extremos <= juego.sin_numeros[rival]:
            valor += 6
        if companero is not None and extremos <= juego.sin_numeros[companero]:
            valor -= 3
        return valor + rng.random()  # desempate al azar

    return max(jugadas, key=puntaje)
