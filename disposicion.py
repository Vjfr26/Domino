"""Calcula en qué lugar de la pantalla va cada ficha de la mesa.

Las fichas salen del centro hacia los dos lados. Cuando un brazo llega al borde,
la ficha de la esquina se pone vertical y la fila sigue en sentido contrario,
como una serpiente: el brazo derecho va bajando y el izquierdo va subiendo.
Los dobles se ponen atravesados, como en una mesa de verdad.
"""
from __future__ import annotations

from dataclasses import dataclass

import pygame

from motor import CENTRO, DERECHA, IZQUIERDA, Colocada, Ficha, Mesa

TAMANOS = (30, 26, 22, 18, 14)  # lado de media ficha, del más grande al más chico

# Ficha cualquiera (no doble) para calcular dónde iría la siguiente jugada.
_HUECO = Colocada(Ficha(0, 1), 0, 1)


@dataclass
class FichaEnMesa:
    ficha: Ficha
    rect: pygame.Rect
    numeros: tuple[int, int]  # (izquierda, derecha), o (arriba, abajo) si es vertical
    vertical: bool


@dataclass
class Disposicion:
    fichas: list[FichaEnMesa]
    huecos: dict[str, pygame.Rect]  # dónde iría la siguiente ficha por cada lado
    tam: int


def disponer(mesa: Mesa, area: pygame.Rect) -> Disposicion:
    """Prueba tamaños de mayor a menor hasta que toda la mesa quepa en `area`."""
    for tam in TAMANOS:
        disp = _disponer(mesa, area, tam)
        rects = [f.rect for f in disp.fichas] + list(disp.huecos.values())
        if all(area.contains(r) for r in rects):
            break
    return disp


def _disponer(mesa: Mesa, area: pygame.Rect, tam: int) -> Disposicion:
    cx, cy = area.center
    largo = 2 * tam
    if mesa.vacia:
        return Disposicion([], {CENTRO: pygame.Rect(cx - tam, cy - tam // 2, largo, tam)}, tam)

    centro = mesa.centro
    if centro.es_doble:
        rect = pygame.Rect(cx - tam // 2, cy - tam, tam, largo)
    else:
        rect = pygame.Rect(cx - tam, cy - tam // 2, largo, tam)
    fichas = [FichaEnMesa(centro, rect, (centro.a, centro.b), centro.es_doble)]

    huecos = {}
    for lado, x, sentido in ((DERECHA, rect.right, 1), (IZQUIERDA, rect.left, -1)):
        brazo = _brazo(mesa.brazos[lado] + [_HUECO], x, cy, sentido, area, tam)
        fichas.extend(brazo[:-1])
        huecos[lado] = brazo[-1].rect
    return Disposicion(fichas, huecos, tam)


def _brazo(colocadas: list[Colocada], x: int, y: int, sentido: int,
           area: pygame.Rect, tam: int) -> list[FichaEnMesa]:
    """Coloca un brazo empezando en el punto (x, y).

    `sentido` es 1 hacia la derecha y -1 hacia la izquierda. Al llegar al borde,
    el brazo que salió hacia la derecha gira hacia abajo y el otro hacia arriba.
    """
    giro = sentido  # 1: las filas nuevas van abajo, -1: van arriba
    largo = 2 * tam
    resultado = []
    tras_esquina = False
    for c in colocadas:
        # Justo después de una esquina el doble va acostado para no chocar con ella.
        atravesada = c.ficha.es_doble and not tras_esquina
        ancho = tam if atravesada else largo
        if sentido == 1:
            cabe = x + ancho <= area.right - tam
        else:
            cabe = x - ancho >= area.left + tam

        if not cabe:
            # Ficha de la esquina: vertical, y la siguiente fila va al revés.
            columna = x if sentido == 1 else x - tam
            if giro == 1:
                rect = pygame.Rect(columna, y - tam // 2, tam, largo)
                numeros = (c.interior, c.exterior)
            else:
                rect = pygame.Rect(columna, y - largo + tam // 2, tam, largo)
                numeros = (c.exterior, c.interior)
            resultado.append(FichaEnMesa(c.ficha, rect, numeros, True))
            y += giro * largo
            sentido = -sentido
            x = columna + tam if sentido == -1 else columna
            tras_esquina = True
            continue

        if sentido == 1:
            izquierda = x
            x += ancho
        else:
            x -= ancho
            izquierda = x
        if atravesada:
            rect = pygame.Rect(izquierda, y - tam, tam, largo)
            numeros = (c.interior, c.exterior)
        else:
            rect = pygame.Rect(izquierda, y - tam // 2, largo, tam)
            numeros = (c.interior, c.exterior) if sentido == 1 else (c.exterior, c.interior)
        resultado.append(FichaEnMesa(c.ficha, rect, numeros, atravesada))
        tras_esquina = False
    return resultado
