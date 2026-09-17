#!/usr/bin/env python3
"""Convertit un atlas SHOM NetCDF-CF 2D en tuiles JSON légères pour CoachBrief.

Usage:
  python3 scripts/shom_netcdf_to_tiles.py \
    --atlas bretagne-nord \
    --neap atlas_ME.nc \
    --spring atlas_VE.nc \
    --out public/shom-current

Dépendances de préparation seulement:
  pip install netCDF4 numpy
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

try:
    import netCDF4  # type: ignore
    import numpy as np  # type: ignore
except ImportError as exc:
    raise SystemExit("Installer d'abord: pip install netCDF4 numpy") from exc


def pick_variable(dataset, names):
    lowered = {name.lower(): name for name in dataset.variables}
    for candidate in names:
        if candidate.lower() in lowered:
            return dataset.variables[lowered[candidate.lower()]]
    raise KeyError(f"Variable introuvable parmi {names}; disponibles: {list(dataset.variables)}")


def read_dataset(path: Path):
    ds = netCDF4.Dataset(path)
    lat = pick_variable(ds, ["lat", "latitude", "nav_lat", "y"])
    lon = pick_variable(ds, ["lon", "longitude", "nav_lon", "x"])
    time = pick_variable(ds, ["time", "phase", "hour", "hours"])
    u = pick_variable(ds, ["u", "uo", "eastward_sea_water_velocity", "u_current"])
    v = pick_variable(ds, ["v", "vo", "northward_sea_water_velocity", "v_current"])

    lat_values = np.asarray(lat[:], dtype=float)
    lon_values = np.asarray(lon[:], dtype=float)
    time_values = np.asarray(time[:], dtype=float).reshape(-1)
    u_values = np.ma.filled(u[:], np.nan).astype(float)
    v_values = np.ma.filled(v[:], np.nan).astype(float)

    if lat_values.ndim == 1 and lon_values.ndim == 1:
        lon_grid, lat_grid = np.meshgrid(lon_values, lat_values)
    elif lat_values.shape == lon_values.shape:
        lat_grid, lon_grid = lat_values, lon_values
    else:
        raise ValueError("Géométrie latitude/longitude non prise en charge")

    time_len = len(time_values)
    time_axis = next((i for i, size in enumerate(u_values.shape) if size == time_len), None)
    if time_axis is None:
        raise ValueError("Impossible d'identifier l'axe temporel de u/v")
    u_values = np.moveaxis(u_values, time_axis, 0)
    v_values = np.moveaxis(v_values, time_axis, 0)
    while u_values.ndim > 3:
        u_values = u_values[:, 0]
        v_values = v_values[:, 0]
    if u_values.shape[1:] != lat_grid.shape:
        if u_values.shape[1:] == lat_grid.T.shape:
            lat_grid, lon_grid = lat_grid.T, lon_grid.T
        else:
            raise ValueError(f"Dimensions incompatibles u={u_values.shape}, grille={lat_grid.shape}")

    return ds, lat_grid, lon_grid, time_values, u_values, v_values


def phase_minutes(time_var, raw_times):
    units = str(getattr(time_var, "units", "")).lower()
    factor = 1.0 if "minute" in units else 1.0 / 60.0 if "second" in units else 60.0
    values = [int(round(float(value) * factor)) for value in raw_times]
    if values and min(values) >= 0 and max(values) <= 30 and not units:
        step = 720 / max(1, len(values) - 1)
        values = [int(round(-360 + i * step)) for i in range(len(values))]
    return values


def tile_key(lat: float, lon: float, size: float) -> str:
    lat_floor = math.floor(lat / size) * size
    lon_floor = math.floor(lon / size) * size
    return f"{lat_floor:+06.2f}_{lon_floor:+07.2f}".replace(".", "p")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", required=True)
    parser.add_argument("--neap", required=True, type=Path, help="NetCDF coefficient 45")
    parser.add_argument("--spring", required=True, type=Path, help="NetCDF coefficient 95")
    parser.add_argument("--out", default=Path("public/shom-current"), type=Path)
    parser.add_argument("--tile-size", default=0.25, type=float)
    args = parser.parse_args()

    neap_ds, lat, lon, times45, u45, v45 = read_dataset(args.neap)
    spring_ds, lat95, lon95, times95, u95, v95 = read_dataset(args.spring)
    if lat.shape != lat95.shape or lon.shape != lon95.shape or u45.shape != u95.shape:
        raise SystemExit("Les grilles morte-eau et vive-eau ne correspondent pas")
    if not np.allclose(lat, lat95, equal_nan=True) or not np.allclose(lon, lon95, equal_nan=True):
        raise SystemExit("Les coordonnées des deux fichiers ne correspondent pas")

    phase45 = phase_minutes(pick_variable(neap_ds, ["time", "phase", "hour", "hours"]), times45)
    phase95 = phase_minutes(pick_variable(spring_ds, ["time", "phase", "hour", "hours"]), times95)
    if phase45 != phase95:
        raise SystemExit("Les phases temporelles morte-eau / vive-eau diffèrent")

    tiles: dict[str, list[dict]] = {}
    rows, cols = lat.shape
    for y in range(rows):
        for x in range(cols):
            latitude = float(lat[y, x]); longitude = float(lon[y, x])
            if not (math.isfinite(latitude) and math.isfinite(longitude)):
                continue
            series45 = []
            series95 = []
            valid = False
            for t, phase in enumerate(phase45):
                a, b, c, d = float(u45[t, y, x]), float(v45[t, y, x]), float(u95[t, y, x]), float(v95[t, y, x])
                if any(math.isfinite(value) for value in (a, b, c, d)):
                    valid = True
                series45.append([phase, None if not math.isfinite(a) else round(a, 4), None if not math.isfinite(b) else round(b, 4)])
                series95.append([phase, None if not math.isfinite(c) else round(c, 4), None if not math.isfinite(d) else round(d, 4)])
            if not valid:
                continue
            key = tile_key(latitude, longitude, args.tile_size)
            tiles.setdefault(key, []).append({"lat": round(latitude, 6), "lon": round(longitude, 6), "c45": series45, "c95": series95})

    root = args.out / args.atlas / "tiles"
    root.mkdir(parents=True, exist_ok=True)
    for key, points in tiles.items():
        (root / f"{key}.json").write_text(json.dumps({"points": points}, separators=(",", ":")), encoding="utf-8")

    manifest = {
        "atlas": args.atlas,
        "tileSize": args.tile_size,
        "phaseMinutes": phase45,
        "tileCount": len(tiles),
        "pointCount": sum(len(points) for points in tiles.values()),
        "coefficients": [45, 95],
        "units": "m/s",
        "generatedFrom": [args.neap.name, args.spring.name],
    }
    atlas_dir = args.out / args.atlas
    atlas_dir.mkdir(parents=True, exist_ok=True)
    (atlas_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
