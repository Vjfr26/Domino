import random
import unittest

import ia
from motor import (CENTRO, DERECHA, DOMINO, IZQUIERDA, TRANQUE, Ficha, Juego, Mesa,
                   crear_fichas)


def jugar_turno(juego: Juego, rng: random.Random) -> None:
    """Hace la siguiente acción del jugador de turno como lo haría la computadora."""
    jugada = ia.elegir_jugada(juego, rng)
    if jugada:
        juego.jugar(*jugada)
    elif juego.debe_robar():
        juego.robar()
    else:
        juego.pasar()


def jugar_ronda(juego: Juego, rng: random.Random) -> None:
    for _ in range(500):
        if juego.ronda_terminada:
            return
        jugar_turno(juego, rng)
    raise AssertionError("La ronda no terminó")


class TestFichas(unittest.TestCase):
    def test_juego_completo_tiene_28_fichas_distintas(self):
        fichas = crear_fichas()
        self.assertEqual(len(fichas), 28)
        self.assertEqual(len(set(fichas)), 28)
        self.assertEqual(sum(f.puntos for f in fichas), 168)

    def test_otro(self):
        self.assertEqual(Ficha(2, 5).otro(2), 5)
        self.assertEqual(Ficha(2, 5).otro(5), 2)
        self.assertEqual(Ficha(4, 4).otro(4), 4)


class TestMesa(unittest.TestCase):
    def test_colocar_actualiza_extremos(self):
        mesa = Mesa()
        mesa.colocar(Ficha(3, 5), CENTRO)
        self.assertEqual(mesa.extremos(), (3, 5))
        mesa.colocar(Ficha(5, 6), DERECHA)
        mesa.colocar(Ficha(1, 3), IZQUIERDA)
        self.assertEqual(mesa.extremos(), (1, 6))
        self.assertEqual(len(mesa), 3)

    def test_ficha_que_no_entra(self):
        mesa = Mesa()
        mesa.colocar(Ficha(3, 5), CENTRO)
        self.assertEqual(mesa.lados_validos(Ficha(0, 1)), [])
        with self.assertRaises(ValueError):
            mesa.colocar(Ficha(0, 1), DERECHA)

    def test_ficha_que_entra_por_los_dos_lados(self):
        mesa = Mesa()
        mesa.colocar(Ficha(2, 4), CENTRO)
        self.assertEqual(mesa.lados_validos(Ficha(2, 4)), [IZQUIERDA, DERECHA])


class TestJuego(unittest.TestCase):
    def test_reparto_en_parejas(self):
        juego = Juego(4, semilla=1)
        self.assertTrue(all(len(j.mano) == 7 for j in juego.jugadores))
        self.assertEqual(juego.pozo, [])
        self.assertEqual([j.equipo for j in juego.jugadores], [0, 1, 0, 1])

    def test_primera_ronda_sale_el_doble_seis(self):
        for semilla in range(20):
            juego = Juego(4, semilla=semilla)
            self.assertIn(Ficha(6, 6), juego.jugadores[juego.turno].mano)
            self.assertEqual(juego.jugadas_validas(), [(Ficha(6, 6), CENTRO)])

    def test_mano_a_mano_tiene_pozo(self):
        juego = Juego(2, semilla=3)
        self.assertEqual(len(juego.pozo), 14)

    def test_no_se_puede_pasar_con_jugada(self):
        juego = Juego(4, semilla=5)
        with self.assertRaises(ValueError):
            juego.pasar()

    def test_domino_suma_los_puntos_de_todas_las_manos(self):
        juego = Juego(4, semilla=0)
        juego.ficha_obligada = None
        juego.turno = 0
        juego.jugadores[0].mano = [Ficha(1, 2)]
        juego.jugadores[1].mano = [Ficha(6, 6)]
        juego.jugadores[2].mano = [Ficha(0, 3)]
        juego.jugadores[3].mano = [Ficha(4, 5), Ficha(0, 0)]
        juego.jugar(Ficha(1, 2), CENTRO)
        r = juego.resultado
        self.assertEqual((r.motivo, r.ganador, r.equipo, r.puntos), (DOMINO, 0, 0, 24))
        self.assertEqual(juego.puntos, [24, 0])

    def test_tranque_gana_quien_tiene_menos_puntos(self):
        juego = Juego(4, semilla=0)
        juego.ficha_obligada = None
        juego.turno = 0
        juego.jugadores[0].mano = [Ficha(0, 0), Ficha(6, 6)]
        juego.jugadores[1].mano = [Ficha(1, 1)]
        juego.jugadores[2].mano = [Ficha(2, 2)]
        juego.jugadores[3].mano = [Ficha(3, 3)]
        juego.jugar(Ficha(0, 0), CENTRO)  # nadie más tiene un cero
        r = juego.resultado
        self.assertEqual((r.motivo, r.ganador, r.equipo, r.puntos), (TRANQUE, 1, 1, 24))

    def test_tranque_empatado_no_suma(self):
        juego = Juego(4, semilla=0)
        juego.ficha_obligada = None
        juego.turno = 0
        juego.jugadores[0].mano = [Ficha(0, 0), Ficha(2, 2)]
        juego.jugadores[1].mano = [Ficha(1, 3)]
        juego.jugadores[2].mano = [Ficha(5, 5)]
        juego.jugadores[3].mano = [Ficha(6, 6)]
        juego.abridor = 0
        juego.jugar(Ficha(0, 0), CENTRO)
        self.assertIsNone(juego.resultado.ganador)
        self.assertEqual(juego.puntos, [0, 0])
        juego.nueva_ronda()
        self.assertEqual(juego.turno, 1)  # abre el siguiente al que abrió

    def test_el_ganador_abre_la_siguiente_ronda(self):
        for semilla in range(10):
            rng = random.Random(semilla)
            juego = Juego(4, semilla=semilla)
            jugar_ronda(juego, rng)
            ganador = juego.resultado.ganador
            if ganador is not None:
                juego.nueva_ronda()
                self.assertEqual(juego.turno, ganador)
                self.assertIsNone(juego.ficha_obligada)

    def test_partidas_completas(self):
        """Simula muchas partidas enteras y revisa que no se pierdan ni repitan fichas."""
        for num_jugadores in (2, 4):
            for semilla in range(60):
                rng = random.Random(semilla)
                juego = Juego(num_jugadores, semilla=semilla)
                while True:
                    jugar_ronda(juego, rng)
                    fichas = juego.mesa.fichas() + juego.pozo + [f for j in juego.jugadores for f in j.mano]
                    self.assertEqual(sorted(fichas), sorted(crear_fichas()))
                    if juego.ganador_partida is not None:
                        break
                    juego.nueva_ronda()
                self.assertGreaterEqual(max(juego.puntos), juego.meta)


if __name__ == "__main__":
    unittest.main()
