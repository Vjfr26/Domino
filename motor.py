"""Reglas y estado del dominó (doble seis), sin nada de gráficos.

Reglas (estilo latino):

* 28 fichas, del doble cero al doble seis, 7 por jugador.
* 4 jugadores: juegan en parejas (0 y 2 contra 1 y 3). No hay pozo:
  si no tienes ficha que entre, pasas.
* 2 jugadores: las 14 fichas que sobran forman el pozo. Si no puedes jugar,
  robas hasta que puedas; si el pozo está vacío, pasas.
* La primera ronda la abre quien tenga el doble más alto, jugándolo.
  Las siguientes las abre quien ganó la ronda anterior, con la ficha que quiera.
* La ronda termina con "dominó" (alguien se queda sin fichas) o con "tranque"
  (nadie puede jugar). En el tranque gana quien tenga menos puntos en la mano;
  si empatan jugadores de equipos distintos, nadie suma.
* El equipo ganador suma los puntos de todas las fichas que quedan en las manos.
* Gana la partida el primer equipo que llegue a la meta de puntos.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

IZQUIERDA = "izquierda"
DERECHA = "derecha"
CENTRO = "centro"  # la primera ficha de la ronda

DOMINO = "domino"
TRANQUE = "tranque"

NOMBRES_4 = ["Tú", "Pedro", "Lucía", "Andrés"]
NOMBRES_2 = ["Tú", "Pedro"]


@dataclass(frozen=True, order=True)
class Ficha:
    a: int
    b: int

    @property
    def puntos(self) -> int:
        return self.a + self.b

    @property
    def es_doble(self) -> bool:
        return self.a == self.b

    def tiene(self, numero: int) -> bool:
        return numero in (self.a, self.b)

    def otro(self, numero: int) -> int:
        """El número del lado contrario al que vale `numero`."""
        return self.b if self.a == numero else self.a

    def __str__(self) -> str:
        return f"[{self.a}|{self.b}]"


def crear_fichas() -> list[Ficha]:
    """Las 28 fichas del doble seis."""
    return [Ficha(a, b) for a in range(7) for b in range(a, 7)]


@dataclass(frozen=True)
class Colocada:
    """Una ficha puesta en la mesa a un lado del centro."""
    ficha: Ficha
    interior: int  # número que toca a la ficha anterior
    exterior: int  # número que queda libre


class Mesa:
    """Las fichas jugadas: una ficha central y dos brazos que crecen hacia afuera."""

    def __init__(self) -> None:
        self.centro: Ficha | None = None
        self.brazos: dict[str, list[Colocada]] = {IZQUIERDA: [], DERECHA: []}

    @property
    def vacia(self) -> bool:
        return self.centro is None

    def extremo(self, lado: str) -> int:
        brazo = self.brazos[lado]
        if brazo:
            return brazo[-1].exterior
        return self.centro.a if lado == IZQUIERDA else self.centro.b

    def extremos(self) -> tuple[int, int]:
        return self.extremo(IZQUIERDA), self.extremo(DERECHA)

    def lados_validos(self, ficha: Ficha) -> list[str]:
        if self.vacia:
            return [CENTRO]
        return [lado for lado in (IZQUIERDA, DERECHA) if ficha.tiene(self.extremo(lado))]

    def colocar(self, ficha: Ficha, lado: str) -> None:
        if lado not in self.lados_validos(ficha):
            raise ValueError(f"{ficha} no entra por {lado}")
        if lado == CENTRO:
            self.centro = ficha
        else:
            numero = self.extremo(lado)
            self.brazos[lado].append(Colocada(ficha, numero, ficha.otro(numero)))

    def fichas(self) -> list[Ficha]:
        if self.vacia:
            return []
        return [self.centro] + [c.ficha for brazo in self.brazos.values() for c in brazo]

    def __len__(self) -> int:
        return len(self.fichas())


@dataclass
class Jugador:
    nombre: str
    equipo: int
    humano: bool = False
    mano: list[Ficha] = field(default_factory=list)

    def puntos_en_mano(self) -> int:
        return sum(f.puntos for f in self.mano)


@dataclass
class ResultadoRonda:
    motivo: str               # DOMINO o TRANQUE
    ganador: int | None       # jugador que gana la ronda (None si hubo empate)
    equipo: int | None        # equipo que suma los puntos
    puntos: int               # puntos que suma ese equipo
    manos: list[list[Ficha]]  # fichas que le quedaron a cada jugador


class Juego:
    """Una partida completa: varias rondas hasta que un equipo llega a la meta."""

    FICHAS_POR_JUGADOR = 7

    def __init__(self, num_jugadores: int = 4, meta: int = 100, semilla: int | None = None) -> None:
        if num_jugadores not in (2, 4):
            raise ValueError("El dominó se juega con 2 o 4 jugadores")
        self.rng = random.Random(semilla)
        self.meta = meta
        nombres = NOMBRES_4 if num_jugadores == 4 else NOMBRES_2
        self.jugadores = [Jugador(nombre, equipo=i % 2, humano=(i == 0)) for i, nombre in enumerate(nombres)]
        self.puntos = [0, 0]
        self.ronda = 0
        self.mesa = Mesa()
        self.pozo: list[Ficha] = []
        self.turno = 0
        self.abridor = 0
        self.ficha_obligada: Ficha | None = None
        self.resultado: ResultadoRonda | None = None
        # Números que cada jugador demostró no tener (porque pasó con ellos en la mesa).
        self.sin_numeros: list[set[int]] = [set() for _ in self.jugadores]
        self._proximo_abridor: int | None = None
        self.nueva_ronda()

    @property
    def num_jugadores(self) -> int:
        return len(self.jugadores)

    @property
    def en_parejas(self) -> bool:
        return self.num_jugadores == 4

    @property
    def ronda_terminada(self) -> bool:
        return self.resultado is not None

    @property
    def ganador_partida(self) -> int | None:
        """El equipo que llegó a la meta, o None si la partida sigue."""
        for equipo, puntos in enumerate(self.puntos):
            if puntos >= self.meta:
                return equipo
        return None

    def nueva_ronda(self) -> None:
        if self.ganador_partida is not None:
            raise RuntimeError("La partida ya terminó")
        fichas = crear_fichas()
        self.rng.shuffle(fichas)
        n = self.FICHAS_POR_JUGADOR
        for i, jugador in enumerate(self.jugadores):
            jugador.mano = sorted(fichas[i * n:(i + 1) * n])
        self.pozo = fichas[self.num_jugadores * n:]
        self.mesa = Mesa()
        self.resultado = None
        self.sin_numeros = [set() for _ in self.jugadores]
        self.ronda += 1
        if self._proximo_abridor is None:
            self.turno, self.ficha_obligada = self._salida_inicial()
        else:
            self.turno, self.ficha_obligada = self._proximo_abridor, None
        self.abridor = self.turno

    def _salida_inicial(self) -> tuple[int, Ficha]:
        """Quién abre la primera ronda y con qué ficha: el doble más alto
        (o, si nadie tiene dobles, la ficha que más vale)."""
        def peso(par: tuple[int, Ficha]) -> tuple[bool, int, int]:
            ficha = par[1]
            return ficha.es_doble, ficha.puntos, ficha.b

        return max(((i, f) for i, j in enumerate(self.jugadores) for f in j.mano), key=peso)

    def jugadas_validas(self, indice: int | None = None) -> list[tuple[Ficha, str]]:
        """Las jugadas (ficha, lado) que puede hacer un jugador (por defecto, el de turno)."""
        if self.ronda_terminada:
            return []
        if indice is None:
            indice = self.turno
        mano = self.jugadores[indice].mano
        if self.ficha_obligada is not None:
            return [(self.ficha_obligada, CENTRO)] if self.ficha_obligada in mano else []
        return [(f, lado) for f in mano for lado in self.mesa.lados_validos(f)]

    def puede_jugar(self, indice: int | None = None) -> bool:
        return bool(self.jugadas_validas(indice))

    def debe_robar(self) -> bool:
        return not self.ronda_terminada and bool(self.pozo) and not self.puede_jugar()

    def debe_pasar(self) -> bool:
        return not self.ronda_terminada and not self.pozo and not self.puede_jugar()

    def jugar(self, ficha: Ficha, lado: str) -> None:
        if (ficha, lado) not in self.jugadas_validas():
            raise ValueError(f"Jugada no permitida: {ficha} por {lado}")
        jugador = self.jugadores[self.turno]
        jugador.mano.remove(ficha)
        self.mesa.colocar(ficha, lado)
        self.ficha_obligada = None
        if not jugador.mano:
            self._terminar_ronda(DOMINO, self.turno)
        elif not self._alguien_puede_seguir():
            self._terminar_ronda(TRANQUE, self._ganador_tranque())
        else:
            self._pasar_turno()

    def robar(self) -> Ficha:
        """Roba una ficha del pozo. El turno sigue siendo del mismo jugador."""
        if not self.debe_robar():
            raise ValueError("Ahora no se puede robar")
        ficha = self.pozo.pop()
        mano = self.jugadores[self.turno].mano
        mano.append(ficha)
        mano.sort()
        if not self._alguien_puede_seguir():
            self._terminar_ronda(TRANQUE, self._ganador_tranque())
        return ficha

    def pasar(self) -> None:
        if not self.debe_pasar():
            raise ValueError("No puedes pasar si tienes jugada o queda pozo")
        self.sin_numeros[self.turno].update(self.mesa.extremos())
        self._pasar_turno()

    def _pasar_turno(self) -> None:
        self.turno = (self.turno + 1) % self.num_jugadores

    def _alguien_puede_seguir(self) -> bool:
        return bool(self.pozo) or any(self.puede_jugar(i) for i in range(self.num_jugadores))

    def _ganador_tranque(self) -> int | None:
        en_mano = [j.puntos_en_mano() for j in self.jugadores]
        minimo = min(en_mano)
        empatados = [i for i, p in enumerate(en_mano) if p == minimo]
        if len({self.jugadores[i].equipo for i in empatados}) > 1:
            return None
        return empatados[0]

    def _terminar_ronda(self, motivo: str, ganador: int | None) -> None:
        manos = [list(j.mano) for j in self.jugadores]
        if ganador is None:
            equipo, puntos = None, 0
            self._proximo_abridor = (self.abridor + 1) % self.num_jugadores
        else:
            equipo = self.jugadores[ganador].equipo
            puntos = sum(f.puntos for mano in manos for f in mano)
            self.puntos[equipo] += puntos
            self._proximo_abridor = ganador
        self.resultado = ResultadoRonda(motivo, ganador, equipo, puntos, manos)
