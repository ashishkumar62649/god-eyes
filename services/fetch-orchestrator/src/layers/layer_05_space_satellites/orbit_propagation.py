"""Orbit Propagation / Position Computation from TLE.

Computes estimated current positions from TLE orbital elements.
This uses a simplified propagation method suitable for display purposes.

Note: This is estimated position from orbital elements, not live sensor tracking.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

# Constants
EARTH_RADIUS_KM = 6371.0  # Mean Earth radius
MU = 398600.4418  # GM in km^3/s^2 (gravitational parameter)
EARTH_ROTATION_RATE = 7.2921159e-5  # rad/s


@dataclass
class OrbitalPosition:
    """Computed orbital position."""
    estimated_at: datetime
    latitude: float  # degrees, -90 to 90
    longitude: float  # degrees, -180 to 180
    altitude_km: float  # km above Earth surface
    velocity_kms: float | None = None  # km/s
    heading_deg: float | None = None  # degrees, 0-360
    source_age_seconds: int | None = None
    computation_method: str = "simplified-sgp4"
    raw_position_json: dict[str, Any] | None = None


def compute_position_from_tle(
    tle_line1: str,
    tle_line2: str,
    orbital_epoch: datetime | None = None,
    target_time: datetime | None = None,
) -> OrbitalPosition | None:
    """Compute estimated position from TLE lines.
    
    Uses simplified SGP4 propagation for display purposes.
    
    Args:
        tle_line1: First TLE line
        tle_line2: Second TLE line
        orbital_epoch: Epoch of TLE (from TLE data)
        target_time: Time to compute position for (default: now)
        
    Returns:
        Orbital position or None if computation fails
    """
    if target_time is None:
        target_time = datetime.now(timezone.utc)
    elif target_time.tzinfo is None:
        # Defensive: attach UTC to a naive target_time so we never
        # accidentally mix naive/aware datetimes downstream.
        target_time = target_time.replace(tzinfo=timezone.utc)

    # Defensive: same treatment for orbital_epoch so callers may pass
    # either an aware or naive datetime without breaking the math.
    if orbital_epoch is not None and orbital_epoch.tzinfo is None:
        orbital_epoch = orbital_epoch.replace(tzinfo=timezone.utc)

    try:
        # Parse TLE elements
        elements = parse_tle_elements(tle_line1, tle_line2)
        if not elements:
            return None
            
        # Get epoch
        epoch = orbital_epoch if orbital_epoch else elements.get("epoch")
        if not epoch:
            return None
            
        # Calculate time since epoch in minutes
        dt = (target_time - epoch).total_seconds()
        if dt < 0:
            dt = 0  # Don't extrapolate backwards
        minutes_since_epoch = dt / 60.0
        
        # Simplified mean anomaly propagation
        mean_motion = elements["mean_motion"]  # revs per day
        mean_anomaly_epoch = elements["mean_anomaly"]  # radians
        eccentricity = elements["eccentricity"]
        inclination = elements["inclination"]  # degrees
        raan = elements["raan"]  # right ascension of ascending node, degrees
        argument_of_perigee = elements["arg_perigee"]  # degrees
        
        # Mean motion in radians per minute
        mean_motion_rad_per_min = mean_motion * 2 * math.pi / 1440.0
        
        # Propagate mean anomaly
        mean_anomaly = mean_anomaly_epoch + mean_motion_rad_per_min * minutes_since_epoch
        mean_anomaly = mean_anomaly % (2 * math.pi)
        
        # Estimate semi-major axis from mean motion
        # a = (MU / n^2)^(1/3) where n is mean motion in rad/s
        n = mean_motion * 2 * math.pi / 86400.0  # rad/s
        semi_major_axis = (MU / (n ** 2)) ** (1/3)  # km
        
        # Perigee altitude from line 2 (approximate)
        perigee_km = elements.get("perigee_km", 400)
        apogee_km = elements.get("apogee_km", 400)
        altitude_km = (perigee_km + apogee_km) / 2.0
        
        # Calculate position in orbital plane
        # Simplified: assume circular orbit for display purposes
        # True anomaly ≈ mean anomaly for low eccentricity
        true_anomaly = mean_anomaly
        
        # Argument of latitude (sum of argument of perigee and true anomaly)
        arg_lat = math.radians(argument_of_perigee) + true_anomaly
        
        # Convert orbital elements to ECI position
        inc_rad = math.radians(inclination)
        raan_rad = math.radians(raan)
        
        # Position in orbital plane
        r = semi_major_axis * (1 - eccentricity ** 2) / (1 + eccentricity * math.cos(true_anomaly))
        
        x_orb = r * math.cos(arg_lat)
        y_orb = r * math.sin(arg_lat)
        
        # Transform to ECI coordinates
        cos_raan = math.cos(raan_rad)
        sin_raan = math.sin(raan_rad)
        cos_inc = math.cos(inc_rad)
        sin_inc = math.sin(inc_rad)
        
        x_eci = x_orb * cos_raan - y_orb * sin_raan * cos_inc
        y_eci = x_orb * sin_raan + y_orb * cos_raan * cos_inc
        z_eci = y_orb * sin_inc
        
        # Convert ECI to ECEF (accounting for Earth rotation)
        # Sidereal time at epoch
        if epoch:
            j2000 = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
            days_since_j2000 = (epoch - j2000).total_seconds() / 86400.0
            # Greenwich sidereal time in radians
            gmst = 4.894961211 * math.pi / 86400.0 * days_since_j2000 + math.pi
        else:
            gmst = 0
            
        # Add rotation for target time
        earth_rotation_angle = EARTH_ROTATION_RATE * dt
        total_rotation = gmst + earth_rotation_angle
        
        # ECEF coordinates
        x_ecef = x_eci * math.cos(total_rotation) + y_eci * math.sin(total_rotation)
        y_ecef = -x_eci * math.sin(total_rotation) + y_eci * math.cos(total_rotation)
        z_ecef = z_eci
        
        # Convert to lat/lon
        lat = math.atan2(z_ecef, math.sqrt(x_ecef**2 + y_ecef**2))
        lon = math.atan2(y_ecef, x_ecef)
        
        # Convert to degrees
        lat_deg = math.degrees(lat)
        lon_deg = math.degrees(lon)
        
        # Ensure longitude is in -180 to 180 range
        while lon_deg > 180:
            lon_deg -= 360
        while lon_deg < -180:
            lon_deg += 360
            
        # Altitude above mean sea level (simplified)
        surface_distance = math.sqrt(x_ecef**2 + y_ecef**2 + z_ecef**2)
        computed_altitude = surface_distance - EARTH_RADIUS_KM
        # The DB schema requires altitude_km >= 0. Simplified SGP4 can
        # compute slightly negative altitudes for highly eccentric or
        # numerically edge-case objects. Clamp to 0 (sea level) rather
        # than fail the insert.
        if computed_altitude < 0:
            computed_altitude = 0.0
        
        # Compute velocity (vis-viva equation, simplified)
        # v = sqrt(mu * (2/r - 1/a))
        velocity_kms = math.sqrt(MU * (2.0 / (r/1000.0) - 1.0 / (semi_major_axis/1000.0))) / 1000.0
        
        # Calculate heading (azimuth of motion)
        # Simplified: direction of motion in horizontal plane
        heading_deg = (math.degrees(math.atan2(y_ecef, x_ecef)) + 360) % 360
        
        # Source age
        source_age_seconds = int(dt) if epoch else None
        
        return OrbitalPosition(
            estimated_at=target_time,
            latitude=round(lat_deg, 6),
            longitude=round(lon_deg, 6),
            altitude_km=round(computed_altitude, 2),
            velocity_kms=round(velocity_kms, 3) if velocity_kms else None,
            heading_deg=round(heading_deg, 1),
            source_age_seconds=source_age_seconds,
            computation_method="simplified-sgp4",
            raw_position_json={
                "tle_line1_hash": str(hash(tle_line1[:20])),
                "tle_line2_hash": str(hash(tle_line2[:20])),
                "minutes_since_epoch": round(minutes_since_epoch, 2),
                "semi_major_axis_km": round(semi_major_axis, 2),
                "inclination_deg": round(inclination, 2),
                "raan_deg": round(raan, 2),
                "mean_anomaly_rad": round(mean_anomaly, 4),
            }
        )
        
    except Exception as e:
        print(f"[POSITION] Computation error: {e}")
        return None


def parse_tle_elements(tle_line1: str, tle_line2: str) -> dict[str, Any] | None:
    """Parse orbital elements from TLE lines.
    
    Returns dictionary with:
    - epoch: datetime
    - mean_motion: revolutions per day
    - eccentricity: dimensionless
    - inclination: degrees
    - raan: right ascension of ascending node, degrees
    - arg_perigee: argument of perigee, degrees
    - mean_anomaly: radians
    - perigee_km: km
    - apogee_km: km
    """
    if not tle_line1 or not tle_line2:
        return None
        
    if len(tle_line1) < 69 or len(tle_line2) < 69:
        return None
        
    try:
        # Line 1 parsing
        # Catalog number (positions 2-5)
        # Epoch (positions 18-32): YYDDD.DDDDDDDD
        epoch_str = tle_line1[18:32]
        year_short = int(epoch_str[0:2])
        day_of_year = float(epoch_str[2:])
        year = 2000 + year_short if year_short < 50 else 1900 + year_short
        from datetime import timedelta
        epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_of_year - 1)
        
        # Mean motion (revolutions per day), positions 52-63
        mean_motion = float(tle_line2[52:63])
        
        # Line 2 parsing
        # Inclination, positions 8-16
        inclination = float(tle_line2[8:16])
        
        # Right ascension of ascending node, positions 17-25
        raan = float(tle_line2[17:25])
        
        # Eccentricity (decimal point assumed), positions 26-33
        ecc_str = "0." + tle_line2[26:33].replace(" ", "0")
        eccentricity = float(ecc_str)
        
        # Argument of perigee, positions 34-42
        arg_perigee = float(tle_line2[34:42])
        
        # Mean anomaly, positions 43-51
        mean_anomaly = float(tle_line2[43:51])
        mean_anomaly_rad = math.radians(mean_anomaly)
        
        # Revolutions (not used for position)
        
        # Calculate perigee and apogee from mean motion
        n = mean_motion * 2 * math.pi / 86400.0  # rad/s
        semi_major_axis = (MU / (n ** 2)) ** (1/3)
        
        perigee_km = semi_major_axis * (1 - eccentricity) - EARTH_RADIUS_KM
        apogee_km = semi_major_axis * (1 + eccentricity) - EARTH_RADIUS_KM
        
        return {
            "epoch": epoch,
            "mean_motion": mean_motion,
            "eccentricity": eccentricity,
            "inclination": inclination,
            "raan": raan,
            "arg_perigee": arg_perigee,
            "mean_anomaly": mean_anomaly_rad,
            "perigee_km": max(0, perigee_km),
            "apogee_km": max(0, apogee_km),
        }
        
    except (ValueError, IndexError) as e:
        print(f"[TLE PARSE] Error parsing elements: {e}")
        return None


# Standalone test
if __name__ == "__main__":
    # ISS TLE
    tle1 = "1 25544U 98067A   23250.50000000  .00016717  00000-0  10270-3 0  9991"
    tle2 = "2 25544  51.6415 208.9168 0006703  35.0853 325.0284 15.49994638427245"
    
    print("[TEST] Computing ISS position...")
    pos = compute_position_from_tle(tle1, tle2)
    
    if pos:
        print(f"  Estimated at: {pos.estimated_at}")
        print(f"  Latitude: {pos.latitude:.4f}°")
        print(f"  Longitude: {pos.longitude:.4f}°")
        print(f"  Altitude: {pos.altitude_km:.2f} km")
        print(f"  Velocity: {pos.velocity_kms:.3f} km/s")
        print(f"  Heading: {pos.heading_deg:.1f}°")
    else:
        print("  Failed to compute position")