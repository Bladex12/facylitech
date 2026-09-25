from geoalchemy2.elements import WKBElement, WKTElement
from geoalchemy2.shape import to_shape


def punto_desde_coords(lat: float, lon: float) -> WKTElement:
    return WKTElement(f"POINT({lon} {lat})", srid=4326)


def coords_desde_punto(geog: WKBElement | None) -> tuple[float, float] | None:
    if geog is None:
        return None
    punto = to_shape(geog)
    return (punto.y, punto.x)  # (lat, lon)
