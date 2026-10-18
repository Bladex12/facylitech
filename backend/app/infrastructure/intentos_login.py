"""Contador en memoria de intentos de login fallidos (anti fuerza bruta).

Límite conocido (RNF-06: ~20 usuarios, un solo proceso): el estado vive en la
memoria del proceso, así que se pierde al reiniciar y no se comparte entre
varios workers. Si se escala a más procesos, mover a la BD o Redis.
La política (cuántos intentos, qué ventana) es pura y vive en `domain/seguridad.py`.
"""

from datetime import datetime

from app.domain.seguridad import (
    MAX_INTENTOS_FALLIDOS,
    VENTANA_INTENTOS,
    segundos_de_bloqueo,
)


class RegistroIntentosFallidos:
    # Tope de claves distintas: un atacante que prueba correos al azar no puede
    # crecer la memoria sin límite.
    MAX_CLAVES = 10_000

    def __init__(self, maximo: int = MAX_INTENTOS_FALLIDOS, ventana=VENTANA_INTENTOS):
        self.maximo = maximo
        self.ventana = ventana
        self._intentos: dict[str, list[datetime]] = {}

    @staticmethod
    def _clave(email: str) -> str:
        return email.strip().lower()

    def segundos_bloqueado(self, email: str, ahora: datetime) -> int:
        return segundos_de_bloqueo(
            self._intentos.get(self._clave(email), []), ahora, self.maximo, self.ventana
        )

    def registrar_fallo(self, email: str, ahora: datetime) -> None:
        self._purgar(ahora)
        clave = self._clave(email)
        self._intentos.setdefault(clave, []).append(ahora)

    def limpiar(self, email: str) -> None:
        """Tras un login correcto se olvidan los fallos previos."""
        self._intentos.pop(self._clave(email), None)

    def reiniciar(self) -> None:
        self._intentos.clear()

    def __len__(self) -> int:
        return len(self._intentos)

    def _purgar(self, ahora: datetime) -> None:
        """Descarta intentos fuera de la ventana y claves vacías; si aun así se
        supera MAX_CLAVES, descarta las claves con el intento más antiguo."""
        for clave in list(self._intentos):
            vigentes = [t for t in self._intentos[clave] if ahora - t < self.ventana]
            if vigentes:
                self._intentos[clave] = vigentes
            else:
                del self._intentos[clave]
        exceso = len(self._intentos) - self.MAX_CLAVES + 1
        if exceso > 0:
            por_antiguedad = sorted(self._intentos, key=lambda c: self._intentos[c][-1])
            for clave in por_antiguedad[:exceso]:
                del self._intentos[clave]
