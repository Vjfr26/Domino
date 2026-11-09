"""Funciones para dibujar fichas, textos y botones con pygame."""
from __future__ import annotations

import pygame
import pygame.gfxdraw

# Colores
VERDE_MESA = (24, 102, 64)
VERDE_OSCURO = (15, 70, 44)
SOMBRA = (8, 42, 26)
MARFIL = (248, 244, 232)
MARFIL_APAGADO = (178, 176, 166)
NEGRO = (28, 28, 28)
GRIS = (95, 95, 95)
DORADO = (250, 204, 70)
LATON = (176, 140, 60)
ROJO_CLARO = (255, 172, 150)
GRANATE = (126, 30, 42)
GRANATE_CLARO = (168, 56, 68)

# Puntos de cada número en media ficha: (columna, fila) en una cuadrícula de 3x3.
PUNTOS = {
    0: [],
    1: [(1, 1)],
    2: [(0, 0), (2, 2)],
    3: [(0, 0), (1, 1), (2, 2)],
    4: [(0, 0), (2, 0), (0, 2), (2, 2)],
    5: [(0, 0), (2, 0), (1, 1), (0, 2), (2, 2)],
    6: [(0, 0), (0, 1), (0, 2), (2, 0), (2, 1), (2, 2)],
}


def fuente(tam: int, negrita: bool = False) -> pygame.font.Font:
    return pygame.font.SysFont("dejavusans,segoeui,arial,helvetica", tam, bold=negrita)


def escribir(sup: pygame.Surface, fuente: pygame.font.Font, texto: str, color, **posicion) -> pygame.Rect:
    """Escribe un texto. La posición se da como en un Rect: center=(x, y), midleft=(x, y)..."""
    imagen = fuente.render(texto, True, color)
    rect = imagen.get_rect(**posicion)
    sup.blit(imagen, rect)
    return rect


def dibujar_ficha(sup: pygame.Surface, rect: pygame.Rect, numeros: tuple[int, int], vertical: bool,
                  resaltada: bool = False, apagada: bool = False) -> None:
    """Dibuja una ficha boca arriba. `numeros` es (arriba, abajo) si la ficha
    está vertical, o (izquierda, derecha) si está horizontal."""
    rect = pygame.Rect(rect)
    radio = max(3, min(rect.w, rect.h) // 6)
    color_puntos = GRIS if apagada else NEGRO
    pygame.draw.rect(sup, SOMBRA, rect.move(2, 3), border_radius=radio)
    pygame.draw.rect(sup, MARFIL_APAGADO if apagada else MARFIL, rect, border_radius=radio)

    if vertical:
        mitades = [pygame.Rect(rect.x, rect.y, rect.w, rect.h // 2),
                   pygame.Rect(rect.x, rect.centery, rect.w, rect.h - rect.h // 2)]
        margen = rect.w // 6
        pygame.draw.line(sup, color_puntos, (rect.x + margen, rect.centery), (rect.right - margen - 1, rect.centery))
    else:
        mitades = [pygame.Rect(rect.x, rect.y, rect.w // 2, rect.h),
                   pygame.Rect(rect.centerx, rect.y, rect.w - rect.w // 2, rect.h)]
        margen = rect.h // 6
        pygame.draw.line(sup, color_puntos, (rect.centerx, rect.y + margen), (rect.centerx, rect.bottom - margen - 1))
    for mitad, numero in zip(mitades, numeros):
        _dibujar_puntos(sup, mitad, numero, vertical, color_puntos)
    if min(rect.w, rect.h) >= 30:
        pygame.gfxdraw.filled_circle(sup, rect.centerx, rect.centery, 2, LATON)  # el clavito del centro

    if resaltada:
        grosor = 3 if min(rect.w, rect.h) >= 30 else 2
        pygame.draw.rect(sup, DORADO, rect, width=grosor, border_radius=radio)
    else:
        pygame.draw.rect(sup, NEGRO, rect, width=1, border_radius=radio)


def _dibujar_puntos(sup, mitad: pygame.Rect, numero: int, vertical: bool, color) -> None:
    lado = min(mitad.w, mitad.h)
    separacion = lado * 0.27
    radio = max(2, round(lado * 0.085))
    for columna, fila in PUNTOS[numero]:
        if not vertical:  # en horizontal el dibujo de cada mitad va girado
            columna, fila = fila, columna
        x = round(mitad.centerx + (columna - 1) * separacion)
        y = round(mitad.centery + (fila - 1) * separacion)
        pygame.gfxdraw.aacircle(sup, x, y, radio, color)
        pygame.gfxdraw.filled_circle(sup, x, y, radio, color)


def dibujar_reverso(sup: pygame.Surface, rect: pygame.Rect) -> None:
    """Dibuja una ficha boca abajo."""
    rect = pygame.Rect(rect)
    radio = max(3, min(rect.w, rect.h) // 6)
    pygame.draw.rect(sup, SOMBRA, rect.move(2, 3), border_radius=radio)
    pygame.draw.rect(sup, GRANATE, rect, border_radius=radio)
    pygame.draw.rect(sup, GRANATE_CLARO, rect.inflate(-6, -6), width=1, border_radius=max(2, radio - 2))
    pygame.draw.rect(sup, NEGRO, rect, width=1, border_radius=radio)


def dibujar_hueco(sup: pygame.Surface, rect: pygame.Rect, brillo: float) -> None:
    """Marca un lugar de la mesa donde se puede poner la ficha elegida. `brillo` va de 0 a 1."""
    capa = pygame.Surface(rect.size, pygame.SRCALPHA)
    pygame.draw.rect(capa, (*DORADO, int(80 + 110 * brillo)), capa.get_rect(), border_radius=6)
    sup.blit(capa, rect)
    pygame.draw.rect(sup, DORADO, rect, width=2, border_radius=6)


def dibujar_panel(sup: pygame.Surface, rect: pygame.Rect, opacidad: int = 255, borde: bool = False) -> None:
    capa = pygame.Surface(rect.size, pygame.SRCALPHA)
    pygame.draw.rect(capa, (8, 36, 22, opacidad), capa.get_rect(), border_radius=14)
    sup.blit(capa, rect)
    if borde:
        pygame.draw.rect(sup, DORADO, rect, width=2, border_radius=14)


def dibujar_globo(sup: pygame.Surface, fuente: pygame.font.Font, texto: str, **posicion) -> None:
    """Un cartelito como "¡Paso!" junto a un jugador."""
    imagen = fuente.render(texto, True, NEGRO)
    rect = imagen.get_rect().inflate(24, 12)
    setattr(rect, *next(iter(posicion.items())))
    pygame.draw.rect(sup, SOMBRA, rect.move(2, 3), border_radius=12)
    pygame.draw.rect(sup, MARFIL, rect, border_radius=12)
    pygame.draw.rect(sup, DORADO, rect, width=2, border_radius=12)
    sup.blit(imagen, imagen.get_rect(center=rect.center))


class Boton:
    def __init__(self, texto: str, rect, fuente: pygame.font.Font) -> None:
        self.texto = texto
        self.rect = pygame.Rect(rect)
        self.fuente = fuente

    def dibujar(self, sup: pygame.Surface) -> None:
        encima = self.rect.collidepoint(pygame.mouse.get_pos())
        pygame.draw.rect(sup, SOMBRA, self.rect.move(0, 4), border_radius=10)
        pygame.draw.rect(sup, DORADO if encima else MARFIL, self.rect, border_radius=10)
        escribir(sup, self.fuente, self.texto, NEGRO, center=self.rect.center)

    def pulsado(self, pos) -> bool:
        return self.rect.collidepoint(pos)
