import random
import unittest

import pygame

from disposicion import disponer
from motor import CENTRO, Juego
from tests.test_motor import jugar_turno

AREA = pygame.Rect(84, 76, 1112, 470)


class TestDisposicion(unittest.TestCase):
    def test_mesa_vacia_tiene_hueco_en_el_centro(self):
        juego = Juego(4, semilla=0)
        disp = disponer(juego.mesa, AREA)
        self.assertEqual(disp.fichas, [])
        self.assertEqual(disp.huecos[CENTRO].center, AREA.center)

    def test_las_fichas_no_se_pisan_ni_se_salen(self):
        for num_jugadores in (2, 4):
            for semilla in range(150):
                rng = random.Random(semilla)
                juego = Juego(num_jugadores, semilla=semilla)
                while not juego.ronda_terminada:
                    jugar_turno(juego, rng)
                    disp = disponer(juego.mesa, AREA)
                    self.assertEqual(len(disp.fichas), len(juego.mesa))
                    rects = [f.rect for f in disp.fichas] + list(disp.huecos.values())
                    for i, r in enumerate(rects):
                        self.assertTrue(AREA.contains(r), f"semilla {semilla}: {r} se sale")
                        self.assertEqual(r.collidelist(rects[i + 1:]), -1,
                                         f"semilla {semilla}: {r} pisa otra ficha")

    def test_fichas_vecinas_se_tocan_por_el_mismo_numero(self):
        """El número de cada ficha que mira hacia la anterior es el mismo que el de la anterior."""
        for semilla in range(50):
            rng = random.Random(semilla)
            juego = Juego(4, semilla=semilla)
            while not juego.ronda_terminada:
                jugar_turno(juego, rng)
            disp = disponer(juego.mesa, AREA)
            for f in disp.fichas:
                self.assertEqual(sorted(f.numeros), [f.ficha.a, f.ficha.b])
            for brazo in juego.mesa.brazos.values():
                for anterior, actual in zip(brazo, brazo[1:]):
                    self.assertEqual(anterior.exterior, actual.interior)


if __name__ == "__main__":
    unittest.main()
