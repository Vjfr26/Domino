"""Dominó doble seis con pygame.

Cómo se juega: haz clic en una ficha de tu mano para ponerla en la mesa. Si entra
por los dos lados, aparecen dos huecos dorados: haz clic en el que prefieras.
Esc vuelve al menú.
"""
from __future__ import annotations

import math
import random
import sys
from dataclasses import dataclass

import pygame

import ia
from dibujo import (DORADO, MARFIL, ROJO_CLARO, SOMBRA, VERDE_MESA, VERDE_OSCURO, Boton,
                    dibujar_ficha, dibujar_globo, dibujar_hueco, dibujar_panel, dibujar_reverso,
                    escribir, fuente)
from disposicion import Disposicion, disponer
from motor import CENTRO, DERECHA, DOMINO, IZQUIERDA, Ficha, Juego, Mesa

ANCHO, ALTO = 1280, 720
AREA_MESA = pygame.Rect(84, 76, 1112, 470)
FICHA_MANO = 42            # media ficha de tu mano, en píxeles
FICHA_OCULTA = 18          # media ficha de los demás jugadores
Y_MANO = ALTO - 2 * FICHA_MANO - 14
Y_MENSAJE = 568
POZO = pygame.Rect(ANCHO - 70, AREA_MESA.centery - 70, 64, 140)

DURACION_ANIMACION = 350   # milisegundos que tarda una ficha en llegar a la mesa
PAUSA_COMPUTADORA = 900    # pausa entre jugadas de la computadora
PAUSA_ROBO = 450
PAUSA_RESULTADO = 1500     # tiempo para ver la última jugada antes del resumen
DURACION_GLOBO = 1300
DURACION_AVISO = 1600

# Dónde se sienta cada jugador. El turno va 0, 1, 2, 3: en contra de las agujas del reloj.
LUGARES = {4: ["abajo", "derecha", "arriba", "izquierda"], 2: ["abajo", "arriba"]}
NUMEROS = ["blanco", "uno", "dos", "tres", "cuatro", "cinco", "seis"]


@dataclass
class Animacion:
    ficha: Ficha
    desde: tuple[int, int]
    inicio: int


def nombre_ficha(ficha: Ficha) -> str:
    if ficha.es_doble:
        return f"el doble {NUMEROS[ficha.a]}"
    return f"el {NUMEROS[ficha.a]}-{NUMEROS[ficha.b]}"


def pulso(ahora: int) -> float:
    """Valor entre 0 y 1 que sube y baja, para que algo parpadee suave."""
    return (math.sin(ahora / 180) + 1) / 2


def crear_mesa_menu() -> Mesa:
    """Unas fichas de adorno para la pantalla de inicio."""
    mesa = Mesa()
    mesa.colocar(Ficha(6, 6), CENTRO)
    for ficha in (Ficha(3, 6), Ficha(3, 3), Ficha(1, 3)):
        mesa.colocar(ficha, DERECHA)
    for ficha in (Ficha(4, 6), Ficha(0, 4), Ficha(0, 0)):
        mesa.colocar(ficha, IZQUIERDA)
    return mesa


def crear_icono() -> pygame.Surface:
    icono = pygame.Surface((32, 32), pygame.SRCALPHA)
    dibujar_ficha(icono, pygame.Rect(8, 0, 16, 29), (5, 2), True)
    return icono


class App:
    def __init__(self) -> None:
        pygame.init()
        pygame.display.set_caption("Dominó")
        pygame.display.set_icon(crear_icono())
        try:
            self.pantalla = pygame.display.set_mode((ANCHO, ALTO), pygame.SCALED | pygame.RESIZABLE)
        except pygame.error:
            self.pantalla = pygame.display.set_mode((ANCHO, ALTO))
        self.reloj = pygame.time.Clock()
        self.f_titulo = fuente(110, negrita=True)
        self.f_grande = fuente(44, negrita=True)
        self.f_media = fuente(26)
        self.f_negrita = fuente(22, negrita=True)
        self.f_chica = fuente(19)
        self.velo = pygame.Surface((ANCHO, ALTO), pygame.SRCALPHA)
        self.velo.fill((0, 0, 0, 140))
        self.rng = random.Random()

        centro = ANCHO // 2
        self.botones_menu = [
            Boton("Parejas (4 jugadores)", (centro - 200, 360, 400, 56), self.f_media),
            Boton("Mano a mano (2 jugadores)", (centro - 200, 430, 400, 56), self.f_media),
            Boton("Salir", (centro - 200, 500, 400, 56), self.f_media),
        ]
        self.boton_accion = Boton("Robar", (centro + 240, Y_MENSAJE - 20, 160, 40), self.f_negrita)
        self.boton_continuar = Boton("Siguiente ronda", (centro - 150, 512, 300, 52), self.f_media)
        self.boton_otra = Boton("Jugar otra vez", (centro - 300, 430, 280, 56), self.f_media)
        self.boton_menu = Boton("Menú principal", (centro + 20, 430, 280, 56), self.f_media)
        self.mesa_menu = crear_mesa_menu()

        self.estado = "menu"  # "menu", "juego" o "final"
        self.juego: Juego | None = None

    # ------------------------------------------------------------------ bucle principal

    def ejecutar(self) -> None:
        while True:
            for evento in pygame.event.get():
                if evento.type == pygame.QUIT:
                    self.salir()
                elif evento.type == pygame.KEYDOWN:
                    self.tecla(evento.key)
                elif evento.type == pygame.MOUSEBUTTONDOWN and evento.button == 1:
                    self.clic(evento.pos)
            if self.estado == "juego":
                self.actualizar()
            self.dibujar()
            pygame.display.flip()
            self.reloj.tick(60)

    def salir(self) -> None:
        pygame.quit()
        sys.exit()

    def tecla(self, tecla: int) -> None:
        if self.estado == "menu":
            if tecla == pygame.K_ESCAPE:
                self.salir()
            elif tecla in (pygame.K_1, pygame.K_KP1):
                self.empezar(4)
            elif tecla in (pygame.K_2, pygame.K_KP2):
                self.empezar(2)
        elif tecla == pygame.K_ESCAPE:
            self.estado = "menu"
        elif tecla in (pygame.K_RETURN, pygame.K_KP_ENTER, pygame.K_SPACE):
            if self.estado == "final":
                self.empezar(self.juego.num_jugadores)
            elif self.resumen_visible():
                self.continuar()

    def clic(self, pos: tuple[int, int]) -> None:
        if self.estado == "menu":
            parejas, mano_a_mano, salir = self.botones_menu
            if parejas.pulsado(pos):
                self.empezar(4)
            elif mano_a_mano.pulsado(pos):
                self.empezar(2)
            elif salir.pulsado(pos):
                self.salir()
        elif self.estado == "final":
            if self.boton_otra.pulsado(pos):
                self.empezar(self.juego.num_jugadores)
            elif self.boton_menu.pulsado(pos):
                self.estado = "menu"
        else:
            self.clic_juego(pos)

    # ------------------------------------------------------------------ partida

    def empezar(self, num_jugadores: int) -> None:
        self.juego = Juego(num_jugadores)
        self.lugares = LUGARES[num_jugadores]
        self.estado = "juego"
        self.preparar_ronda()

    def preparar_ronda(self) -> None:
        self.seleccionada: Ficha | None = None
        self.ultima: Ficha | None = None             # última ficha jugada, se marca en dorado
        self.robada: tuple[Ficha, int] | None = None  # ficha que acabas de robar y hasta cuándo marcarla
        self.animacion: Animacion | None = None
        self.globos: dict[int, tuple[str, int]] = {}
        self.aviso: tuple[str, int] | None = None
        self.resultado_desde: int | None = None
        self.espera_hasta = pygame.time.get_ticks() + 1000
        self._disposicion: tuple[tuple[int, int], Disposicion] | None = None

    def continuar(self) -> None:
        if self.juego.ganador_partida is not None:
            self.estado = "final"
        else:
            self.juego.nueva_ronda()
            self.preparar_ronda()

    def actualizar(self) -> None:
        """Avanza lo que no depende de ti: animaciones y jugadas de la computadora."""
        ahora = pygame.time.get_ticks()
        if self.animacion and ahora - self.animacion.inicio >= DURACION_ANIMACION:
            self.animacion = None
        juego = self.juego
        if juego.ronda_terminada:
            if self.resultado_desde is None:
                self.resultado_desde = ahora + PAUSA_RESULTADO
            return
        if self.animacion or ahora < self.espera_hasta or juego.jugadores[juego.turno].humano:
            return

        indice = juego.turno
        jugada = ia.elegir_jugada(juego, self.rng)
        if jugada:
            self.jugar(*jugada, desde=self.centro_mano_oculta(indice))
            self.espera_hasta = ahora + PAUSA_COMPUTADORA
        elif juego.debe_robar():
            juego.robar()
            self.globo(indice, "Roba del pozo")
            self.espera_hasta = ahora + PAUSA_ROBO
        else:
            juego.pasar()
            self.globo(indice, "¡Paso!")
            self.espera_hasta = ahora + PAUSA_COMPUTADORA

    def jugar(self, ficha: Ficha, lado: str, desde: tuple[int, int]) -> None:
        self.juego.jugar(ficha, lado)
        self.seleccionada = None
        self.ultima = ficha
        self.animacion = Animacion(ficha, desde, pygame.time.get_ticks())

    def mi_turno(self) -> bool:
        juego = self.juego
        return not juego.ronda_terminada and juego.jugadores[juego.turno].humano and self.animacion is None

    def resumen_visible(self) -> bool:
        return (self.estado == "juego" and self.juego.ronda_terminada and self.animacion is None
                and self.resultado_desde is not None and pygame.time.get_ticks() >= self.resultado_desde)

    def globo(self, indice: int, texto: str) -> None:
        self.globos[indice] = (texto, pygame.time.get_ticks() + DURACION_GLOBO)

    def avisar(self, texto: str) -> None:
        self.aviso = (texto, pygame.time.get_ticks() + DURACION_AVISO)

    def clic_juego(self, pos: tuple[int, int]) -> None:
        juego = self.juego
        if juego.ronda_terminada:
            if self.resumen_visible() and self.boton_continuar.pulsado(pos):
                self.continuar()
            return
        if not self.mi_turno():
            return
        ahora = pygame.time.get_ticks()

        if juego.debe_robar() and (self.boton_accion.pulsado(pos) or POZO.collidepoint(pos)):
            self.robada = (juego.robar(), ahora + 1500)
            return
        if juego.debe_pasar() and self.boton_accion.pulsado(pos):
            juego.pasar()
            self.globo(0, "¡Paso!")
            self.espera_hasta = ahora + 600
            return

        if self.seleccionada:
            for lado, rect in self.disposicion().huecos.items():
                if (self.seleccionada, lado) in juego.jugadas_validas() and rect.inflate(20, 20).collidepoint(pos):
                    self.jugar(self.seleccionada, lado, desde=self.rect_en_mano(self.seleccionada).center)
                    self.espera_hasta = ahora + 700
                    return

        for ficha, rect in reversed(self.rects_mano()):  # al revés: primero la que está encima
            if rect.collidepoint(pos):
                self.elegir_ficha(ficha, rect)
                return
        self.seleccionada = None

    def elegir_ficha(self, ficha: Ficha, rect: pygame.Rect) -> None:
        juego = self.juego
        lados = [lado for f, lado in juego.jugadas_validas() if f == ficha]
        if not lados:
            if juego.ficha_obligada:
                self.avisar(f"Tienes que salir con {nombre_ficha(juego.ficha_obligada)}")
            elif juego.puede_jugar():
                self.avisar("Esa ficha no entra en la mesa")
        elif len(lados) == 1:
            self.jugar(ficha, lados[0], desde=rect.center)
            self.espera_hasta = pygame.time.get_ticks() + 700
        else:
            self.seleccionada = None if self.seleccionada == ficha else ficha

    # ------------------------------------------------------------------ posiciones en pantalla

    def disposicion(self) -> Disposicion:
        """Dónde va cada ficha de la mesa (se recalcula solo cuando cambia la mesa)."""
        mesa = self.juego.mesa
        clave = (id(mesa), len(mesa))
        if self._disposicion is None or self._disposicion[0] != clave:
            self._disposicion = (clave, disponer(mesa, AREA_MESA))
        return self._disposicion[1]

    def rects_mano(self) -> list[tuple[Ficha, pygame.Rect]]:
        """Tus fichas, de pie en la parte de abajo. Las que puedes jugar suben un poco."""
        juego = self.juego
        mano = juego.jugadores[0].mano
        jugables = {f for f, _ in juego.jugadas_validas(0)} if self.mi_turno() else set()
        paso = min(FICHA_MANO + 10, (ANCHO - 300) // max(1, len(mano)))
        total = paso * (len(mano) - 1) + FICHA_MANO
        x = ANCHO // 2 - total // 2
        resultado = []
        for i, ficha in enumerate(mano):
            rect = pygame.Rect(x + i * paso, Y_MANO, FICHA_MANO, 2 * FICHA_MANO)
            if ficha == self.seleccionada:
                rect.y -= 26
            elif ficha in jugables:
                rect.y -= 12
            resultado.append((ficha, rect))
        return resultado

    def rect_en_mano(self, ficha: Ficha) -> pygame.Rect:
        return next(rect for f, rect in self.rects_mano() if f == ficha)

    def rects_ocultas(self, indice: int) -> tuple[list[pygame.Rect], bool]:
        """Las fichas de otro jugador y si van de pie (vertical) o acostadas."""
        lugar = self.lugares[indice]
        n = len(self.juego.jugadores[indice].mano)
        s, paso = FICHA_OCULTA, FICHA_OCULTA + 4
        total = paso * (n - 1) + s
        if lugar == "arriba":
            x = ANCHO // 2 - total // 2
            return [pygame.Rect(x + i * paso, 16, s, 2 * s) for i in range(n)], True
        x = 22 if lugar == "izquierda" else ANCHO - 22 - 2 * s
        y = AREA_MESA.centery - total // 2
        return [pygame.Rect(x, y + i * paso, 2 * s, s) for i in range(n)], False

    def centro_mano_oculta(self, indice: int) -> tuple[int, int]:
        rects, _ = self.rects_ocultas(indice)
        return rects[0].unionall(rects[1:]).center

    def lugar_nombre(self, indice: int) -> dict:
        lugar = self.lugares[indice]
        if lugar == "abajo":
            return {"midleft": (24, Y_MANO + FICHA_MANO)}
        rects, _ = self.rects_ocultas(indice)
        if lugar == "arriba":
            x = rects[0].left - 14 if rects else ANCHO // 2 - 14
            return {"midright": (x, 16 + FICHA_OCULTA)}
        y = rects[0].top - 8 if rects else AREA_MESA.centery
        x = 22 + FICHA_OCULTA if lugar == "izquierda" else ANCHO - 22 - FICHA_OCULTA
        return {"midbottom": (x, y)}

    def lugar_globo(self, indice: int) -> dict:
        """Junto a las fichas del jugador, fuera de la mesa para no tapar nada."""
        lugar = self.lugares[indice]
        if lugar == "abajo":
            return {"midbottom": (70, Y_MANO + FICHA_MANO - 22)}
        rects, _ = self.rects_ocultas(indice)
        if lugar == "arriba":
            x = rects[-1].right + 14 if rects else ANCHO // 2 + 14
            return {"midleft": (x, 16 + FICHA_OCULTA)}
        y = rects[-1].bottom + 12 if rects else AREA_MESA.centery
        if lugar == "izquierda":
            return {"topleft": (8, y)}
        return {"topright": (ANCHO - 8, y)}

    def nombre_equipo(self, equipo: int) -> str:
        if self.juego.en_parejas:
            return ("Nosotros", "Ellos")[equipo]
        return self.juego.jugadores[equipo].nombre

    def mensaje(self) -> str:
        juego = self.juego
        if juego.ronda_terminada:
            return ""
        jugador = juego.jugadores[juego.turno]
        if not jugador.humano:
            if juego.ficha_obligada:
                return f"{jugador.nombre} sale con {nombre_ficha(juego.ficha_obligada)}"
            return f"Juega {jugador.nombre}..."
        if juego.ficha_obligada:
            return f"Sales tú: juega {nombre_ficha(juego.ficha_obligada)}"
        if self.seleccionada:
            return "Entra por los dos lados: elige un hueco dorado"
        if juego.debe_robar():
            return "Ninguna ficha entra: roba del pozo"
        if juego.debe_pasar():
            return "Ninguna ficha entra: te toca pasar"
        return "Tu turno: elige una ficha"

    # ------------------------------------------------------------------ dibujo

    def dibujar(self) -> None:
        if self.estado == "menu":
            self.dibujar_menu()
            return
        ahora = pygame.time.get_ticks()
        self.dibujar_juego(ahora)
        if self.estado == "final":
            self.dibujar_final()
        elif self.resumen_visible():
            self.dibujar_resumen()

    def dibujar_menu(self) -> None:
        p = self.pantalla
        p.fill(VERDE_OSCURO)
        pygame.draw.rect(p, VERDE_MESA, p.get_rect().inflate(-60, -60), border_radius=30)
        escribir(p, self.f_titulo, "Dominó", SOMBRA, center=(ANCHO // 2 + 4, 128))
        escribir(p, self.f_titulo, "Dominó", MARFIL, center=(ANCHO // 2, 124))
        escribir(p, self.f_media, "Doble seis · estilo latino", DORADO, center=(ANCHO // 2, 200))
        for f in disponer(self.mesa_menu, pygame.Rect(0, 245, ANCHO, 80)).fichas:
            dibujar_ficha(p, f.rect.inflate(-2, -2), f.numeros, f.vertical)
        for boton in self.botones_menu:
            boton.dibujar(p)
        escribir(p, self.f_chica, "En parejas juegas con Lucía contra Pedro y Andrés. "
                 "Gana el primer equipo que llegue a 100 puntos.", MARFIL, center=(ANCHO // 2, 616))

    def dibujar_juego(self, ahora: int) -> None:
        p = self.pantalla
        juego = self.juego
        p.fill(VERDE_OSCURO)
        pygame.draw.rect(p, VERDE_MESA, AREA_MESA.inflate(24, 24), border_radius=22)

        disp = self.disposicion()
        animada = self.animacion.ficha if self.animacion else None
        for f in disp.fichas:
            if f.ficha != animada:
                dibujar_ficha(p, f.rect.inflate(-2, -2), f.numeros, f.vertical, resaltada=(f.ficha == self.ultima))
        if self.seleccionada:
            for lado, rect in disp.huecos.items():
                if (self.seleccionada, lado) in juego.jugadas_validas():
                    dibujar_hueco(p, rect, pulso(ahora))

        for indice in range(1, juego.num_jugadores):
            self.dibujar_mano_oculta(indice)
        if not juego.en_parejas:
            self.dibujar_pozo(ahora)
        self.dibujar_mano(ahora)
        self.dibujar_nombres()
        self.dibujar_marcador()
        self.dibujar_mensaje(ahora)
        if self.animacion:
            self.dibujar_animacion(ahora, disp)
        for indice, (texto, hasta) in self.globos.items():
            if ahora < hasta:
                dibujar_globo(p, self.f_negrita, texto, **self.lugar_globo(indice))

    def dibujar_mano(self, ahora: int) -> None:
        jugables = {f for f, _ in self.juego.jugadas_validas(0)}
        mi_turno = self.mi_turno()
        for ficha, rect in self.rects_mano():
            recien_robada = self.robada is not None and self.robada[0] == ficha and ahora < self.robada[1]
            dibujar_ficha(self.pantalla, rect, (ficha.a, ficha.b), True,
                          resaltada=(ficha == self.seleccionada or recien_robada),
                          apagada=(mi_turno and ficha not in jugables))

    def dibujar_mano_oculta(self, indice: int) -> None:
        juego = self.juego
        rects, vertical = self.rects_ocultas(indice)
        for ficha, rect in zip(juego.jugadores[indice].mano, rects):
            if juego.ronda_terminada:  # al terminar la ronda se enseñan las fichas
                dibujar_ficha(self.pantalla, rect, (ficha.a, ficha.b), vertical)
            else:
                dibujar_reverso(self.pantalla, rect)

    def dibujar_pozo(self, ahora: int) -> None:
        p = self.pantalla
        cantidad = len(self.juego.pozo)
        escribir(p, self.f_chica, "Pozo", MARFIL, midtop=(POZO.centerx, POZO.top + 4))
        for k in range(min(cantidad, 5)):
            rect = pygame.Rect(0, 0, 2 * FICHA_OCULTA, FICHA_OCULTA)
            rect.center = (POZO.centerx, POZO.centery + 16 - k * 6)
            dibujar_reverso(p, rect)
        escribir(p, self.f_negrita, str(cantidad), DORADO, midbottom=(POZO.centerx, POZO.bottom - 4))
        if self.mi_turno() and self.juego.debe_robar():
            grosor = 2 + round(pulso(ahora) * 2)
            pygame.draw.rect(p, DORADO, POZO, width=grosor, border_radius=10)

    def dibujar_nombres(self) -> None:
        juego = self.juego
        for indice, jugador in enumerate(juego.jugadores):
            texto = jugador.nombre
            if juego.en_parejas and indice == 2:
                texto += " (compañera)"
            de_turno = indice == juego.turno and not juego.ronda_terminada
            escribir(self.pantalla, self.f_negrita, texto, DORADO if de_turno else MARFIL,
                     **self.lugar_nombre(indice))

    def dibujar_marcador(self) -> None:
        p = self.pantalla
        juego = self.juego
        panel = pygame.Rect(14, 10, 340, 56)
        dibujar_panel(p, panel, 150)
        columnas = [(self.nombre_equipo(0), str(juego.puntos[0])),
                    (self.nombre_equipo(1), str(juego.puntos[1])),
                    (f"Ronda {juego.ronda}", f"a {juego.meta}")]
        for k, (arriba, abajo) in enumerate(columnas):
            x = panel.x + 16 + k * 110
            escribir(p, self.f_chica, arriba, MARFIL, topleft=(x, panel.y + 5))
            escribir(p, self.f_negrita, abajo, DORADO, topleft=(x, panel.y + 27))
        escribir(p, self.f_chica, "Esc: menú", MARFIL, topright=(ANCHO - 16, 12))

    def dibujar_mensaje(self, ahora: int) -> None:
        juego = self.juego
        if self.aviso and ahora < self.aviso[1]:
            escribir(self.pantalla, self.f_media, self.aviso[0], ROJO_CLARO, center=(ANCHO // 2, Y_MENSAJE))
        else:
            escribir(self.pantalla, self.f_media, self.mensaje(), MARFIL, center=(ANCHO // 2, Y_MENSAJE))
        if self.mi_turno() and (juego.debe_robar() or juego.debe_pasar()):
            self.boton_accion.texto = "Robar" if juego.debe_robar() else "Pasar"
            self.boton_accion.dibujar(self.pantalla)

    def dibujar_animacion(self, ahora: int, disp: Disposicion) -> None:
        destino = next((f for f in disp.fichas if f.ficha == self.animacion.ficha), None)
        if destino is None:
            return
        t = min(1.0, (ahora - self.animacion.inicio) / DURACION_ANIMACION)
        t = 1 - (1 - t) ** 3  # empieza rápido y frena al llegar
        x0, y0 = self.animacion.desde
        rect = destino.rect.inflate(-2, -2)
        rect.center = (round(x0 + (destino.rect.centerx - x0) * t), round(y0 + (destino.rect.centery - y0) * t))
        dibujar_ficha(self.pantalla, rect, destino.numeros, destino.vertical)

    def dibujar_resumen(self) -> None:
        p = self.pantalla
        juego = self.juego
        r = juego.resultado
        p.blit(self.velo, (0, 0))
        panel = pygame.Rect(0, 0, 760, 290 + 50 * juego.num_jugadores)
        panel.center = (ANCHO // 2, ALTO // 2 - 20)
        dibujar_panel(p, panel, borde=True)

        escribir(p, self.f_grande, "¡Dominó!" if r.motivo == DOMINO else "¡Tranque!", DORADO,
                 midtop=(panel.centerx, panel.y + 22))
        detalle, suma = self.textos_resultado()
        escribir(p, self.f_media, detalle, MARFIL, center=(panel.centerx, panel.y + 100))
        escribir(p, self.f_negrita, suma, DORADO, center=(panel.centerx, panel.y + 136))

        for indice, jugador in enumerate(juego.jugadores):
            y = panel.y + 182 + indice * 50
            escribir(p, self.f_negrita, jugador.nombre, MARFIL, midleft=(panel.x + 50, y))
            for k, ficha in enumerate(r.manos[indice]):
                dibujar_ficha(p, pygame.Rect(panel.x + 200 + k * 20, y - 16, 16, 32), (ficha.a, ficha.b), True)
            puntos = sum(f.puntos for f in r.manos[indice])
            escribir(p, self.f_media, f"{puntos} pts", MARFIL, midright=(panel.right - 40, y))

        marcador = f"{self.nombre_equipo(0)} {juego.puntos[0]}   ·   {self.nombre_equipo(1)} {juego.puntos[1]}"
        escribir(p, self.f_media, marcador, MARFIL, center=(panel.centerx, panel.bottom - 98))
        self.boton_continuar.texto = "Ver resultado final" if juego.ganador_partida is not None else "Siguiente ronda"
        self.boton_continuar.rect.midbottom = (panel.centerx, panel.bottom - 22)
        self.boton_continuar.dibujar(p)

    def textos_resultado(self) -> tuple[str, str]:
        juego = self.juego
        r = juego.resultado
        if r.ganador is None:
            return "Nadie puede jugar y hay empate de puntos.", "Nadie suma esta ronda"
        ganador = juego.jugadores[r.ganador]
        if r.motivo == DOMINO:
            detalle = "¡Te quedaste sin fichas!" if ganador.humano else f"{ganador.nombre} se quedó sin fichas."
        else:
            quien = "Tú tienes" if ganador.humano else f"{ganador.nombre} tiene"
            detalle = f"Nadie puede jugar. {quien} menos puntos."
        if juego.en_parejas:
            suma = f"Sumamos {r.puntos} puntos" if r.equipo == 0 else f"Ellos suman {r.puntos} puntos"
        else:
            suma = f"Sumas {r.puntos} puntos" if r.equipo == 0 else f"{ganador.nombre} suma {r.puntos} puntos"
        return detalle, suma

    def dibujar_final(self) -> None:
        p = self.pantalla
        juego = self.juego
        p.blit(self.velo, (0, 0))
        panel = pygame.Rect(0, 0, 640, 340)
        panel.center = (ANCHO // 2, 330)
        dibujar_panel(p, panel, borde=True)
        ganamos = juego.ganador_partida == 0
        if juego.en_parejas:
            titulo = "¡Ganamos la partida!" if ganamos else "Perdimos la partida"
        else:
            titulo = "¡Ganaste la partida!" if ganamos else f"{juego.jugadores[1].nombre} gana la partida"
        escribir(p, self.f_grande, titulo, DORADO if ganamos else MARFIL, center=(panel.centerx, panel.y + 70))
        marcador = f"{self.nombre_equipo(0)} {juego.puntos[0]}   ·   {self.nombre_equipo(1)} {juego.puntos[1]}"
        escribir(p, self.f_media, marcador, MARFIL, center=(panel.centerx, panel.y + 140))
        escribir(p, self.f_chica, f"Rondas jugadas: {juego.ronda}", MARFIL, center=(panel.centerx, panel.y + 180))
        self.boton_otra.dibujar(p)
        self.boton_menu.dibujar(p)


if __name__ == "__main__":
    App().ejecutar()
